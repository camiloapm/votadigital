import { createClient } from '@supabase/supabase-js';

let supabase = null;

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  if (!supabase) supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });
  return supabase;
}

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/health' || url.pathname === '/api/health/') {
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-code');
    return res.status(200).end();
  }

  // ======== RUTAS EXPLÍCITAS ========
  const explicitRoutes = {
    '/api/admin/login': 'login', '/api/admin/login/': 'login',
    '/api/admin/students': 'students', '/api/admin/students/': 'students',
    '/api/admin/candidates': 'candidates', '/api/admin/candidates/': 'candidates',
    '/api/admin/election': 'election', '/api/admin/election/': 'election',
    '/api/admin/election-mode': 'election-mode', '/api/admin/election-mode/': 'election-mode',
    '/api/admin/voting-flow': 'voting-flow', '/api/admin/voting-flow/': 'voting-flow',
    '/api/admin/import': 'import', '/api/admin/import/': 'import',
    '/api/admin/reset-codes': 'reset-codes', '/api/admin/reset-codes/': 'reset-codes',
    '/api/admin/reset-votes': 'reset-votes', '/api/admin/reset-votes/': 'reset-votes',
    '/api/admin/clear-data': 'clear-data', '/api/admin/clear-data/': 'clear-data',
    '/api/admin/clear-students': 'clear-students', '/api/admin/clear-students/': 'clear-students',
  };

  if (explicitRoutes[url.pathname]) {
    return await handleAdmin(req, res, explicitRoutes[url.pathname]);
  }

  const pathParts = url.pathname.replace('/api/', '').split('/').filter(Boolean);
  const endpoint = pathParts[0];
  const subEndpoint = pathParts[1];

  try {
    switch (endpoint) {
      case 'check-status': return await checkStatus(req, res);
      case 'verify-code': return await verifyCode(req, res);
      case 'cast-vote': return await castVote(req, res);
      case 'get-candidates': return await getCandidates(req, res);
      case 'verify-terminal': return await verifyTerminal(req, res);
      case 'admin': return await handleAdmin(req, res, subEndpoint);
      case 'stats': return await getStats(req, res);
      case 'config': return await handleConfig(req, res);
      case 'results': return await getFinalResults(req, res);
      case 'monitor': return await getMonitorData(req, res);
      default: return res.status(404).json({ error: 'Endpoint no encontrado' });
    }
  } catch (error) {
    console.error('Error:', error.message || error);
    return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
}

// =====================================================
// PUBLIC ENDPOINTS
// =====================================================

async function checkStatus(req, res) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('config')
    .select('election_status, school_logo_url, school_name, election_mode, voting_flow')
    .eq('id', 1)
    .single();

  if (error) return res.status(500).json({ error: 'Error al consultar estado' });

  return res.status(200).json({
    open: data.election_status === 'open',
    status: data.election_status,
    school_logo: data.school_logo_url,
    school_name: data.school_name,
    election_mode: data.election_mode || 'personero',       // 'personero' | 'contralor' | 'ambos'
    voting_flow: data.voting_flow || 'sequential'            // 'sequential' | 'simultaneous'
  });
}

async function verifyCode(req, res) {
  const supabase = getSupabase();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { access_code } = req.body || {};
  if (!access_code || !/^\d{5}$/.test(access_code)) {
    return res.status(400).json({ error: 'Código inválido (debe tener 5 dígitos)' });
  }

  // Ahora seleccionamos voted_personero y voted_contralor
  const { data: student, error } = await supabase
    .from('students')
    .select('id, full_name, grade, course, has_voted, voted_personero, voted_contralor')
    .eq('access_code', access_code)
    .single();

  if (error || !student) return res.status(404).json({ error: 'Código no encontrado' });

  // Obtener el modo de elección actual
  const { data: config } = await supabase
    .from('config')
    .select('election_mode')
    .eq('id', 1)
    .single();

  const mode = config?.election_mode || 'personero';

  // Verificar si ya votó en todo lo requerido
  let alreadyVotedAll = false;
  if (mode === 'personero' && student.voted_personero) alreadyVotedAll = true;
  if (mode === 'contralor' && student.voted_contralor) alreadyVotedAll = true;
  if (mode === 'ambos' && student.voted_personero && student.voted_contralor) alreadyVotedAll = true;

  if (alreadyVotedAll) return res.status(403).json({ error: 'Este código ya ha sido utilizado' });

  return res.status(200).json({
    valid: true,
    student: {
      name: student.full_name,
      grade: student.grade,
      course: student.course,
      voted_personero: student.voted_personero || false,
      voted_contralor: student.voted_contralor || false
    }
  });
}

async function castVote(req, res) {
  const supabase = getSupabase();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { access_code, candidate_id, role } = req.body || {};
  if (!access_code || !candidate_id) return res.status(400).json({ error: 'Datos incompletos' });

  // role debe ser 'personero' o 'contralor'
  const validRole = role === 'contralor' ? 'contralor' : 'personero';

  // Verificar que el candidato pertenece al rol correcto
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, role')
    .eq('id', candidate_id)
    .single();

  if (!candidate) return res.status(404).json({ error: 'Candidato no encontrado' });

  // Si el candidato tiene rol definido, verificar que coincide
  if (candidate.role && candidate.role !== validRole) {
    return res.status(400).json({ error: `Este candidato es de ${candidate.role}, no de ${validRole}` });
  }

  // Usar RPC con rol
  const { data, error } = await supabase.rpc('cast_vote_v2', {
    p_access_code: access_code,
    p_candidate_id: candidate_id,
    p_role: validRole
  });

  if (error) {
    // Fallback al RPC original si cast_vote_v2 no existe
    if (error.message && error.message.includes('does not exist')) {
      const { data: data2, error: error2 } = await supabase.rpc('cast_vote', {
        p_access_code: access_code,
        p_candidate_id: candidate_id
      });
      if (error2) return res.status(500).json({ error: 'Error al procesar voto', details: error2.message });
      const result2 = data2;
      if (!result2.success) return res.status(400).json({ error: result2.error });
      return res.status(200).json({ success: true, message: 'Voto registrado correctamente', student: result2.student });
    }
    return res.status(500).json({ error: 'Error al procesar voto', details: error.message });
  }

  const result = data;
  if (!result.success) return res.status(400).json({ error: result.error });

  return res.status(200).json({
    success: true,
    message: 'Voto registrado correctamente',
    student: result.student
  });
}

async function getCandidates(req, res) {
  const supabase = getSupabase();

  // Si viene ?role=personero o ?role=contralor filtramos
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roleFilter = url.searchParams.get('role');

  let query = supabase
    .from('candidates')
    .select('id, name, party, photo_url, role')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name');

  if (roleFilter && ['personero', 'contralor'].includes(roleFilter)) {
    query = query.eq('role', roleFilter);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Error al cargar candidatos' });
  return res.status(200).json({ candidates: data });
}

async function verifyTerminal(req, res) {
  const supabase = getSupabase();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { voting_password } = req.body || {};
  if (!voting_password) return res.status(400).json({ error: 'Contraseña requerida' });

  const { data: config, error } = await supabase.from('config').select('voting_password').eq('id', 1).single();
  if (error || !config) return res.status(500).json({ error: 'Error al verificar contraseña' });

  if (!config.voting_password || config.voting_password.trim() === '') {
    return res.status(200).json({ valid: true, noPassword: true });
  }

  if (voting_password !== config.voting_password) {
    return res.status(401).json({ error: 'Contraseña de terminal incorrecta' });
  }

  return res.status(200).json({ valid: true });
}

async function handleConfig(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('config')
      .select('school_logo_url, school_name, voting_password, election_mode, voting_flow')
      .eq('id', 1)
      .single();
    if (error) return res.status(500).json({ error: 'Error' });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const adminCode = req.headers['x-admin-code'];
    const { data: config, error: cfgErr } = await supabase.from('config').select('admin_code').eq('id', 1).single();
    if (cfgErr || !config || adminCode !== config.admin_code) return res.status(401).json({ error: 'No autorizado' });

    const { school_logo_url, school_name, voting_password } = req.body || {};
    const { data: current } = await supabase.from('config').select('school_logo_url, school_name, voting_password').eq('id', 1).single();

    const updates = {
      school_name: (school_name && school_name.trim() !== '') ? school_name.trim() : (current?.school_name || 'Colegio'),
      school_logo_url: (school_logo_url && school_logo_url.trim() !== '') ? school_logo_url : (current?.school_logo_url || null),
    };
    if (voting_password !== undefined) updates.voting_password = voting_password;

    const { error } = await supabase.from('config').update(updates).eq('id', 1);
    if (error) return res.status(500).json({ error: 'Error al actualizar' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// =====================================================
// ADMIN
// =====================================================

async function handleAdmin(req, res, subEndpoint) {
  const supabase = getSupabase();

  if (subEndpoint === 'login') return res.status(200).json({ success: true });

  const adminCode = req.headers['x-admin-code'] || req.body?.admin_code;
  const { data: config, error } = await supabase.from('config').select('admin_code').eq('id', 1).single();
  if (error || !config || adminCode !== config.admin_code) return res.status(401).json({ error: 'Código de administrador inválido' });

  switch (subEndpoint) {
    case 'students': return await handleStudents(req, res);
    case 'candidates': return await handleCandidates(req, res);
    case 'election': return await handleElection(req, res);
    case 'election-mode': return await handleElectionMode(req, res);
    case 'voting-flow': return await handleVotingFlow(req, res);
    case 'import': return await importStudents(req, res);
    case 'reset-codes': return await resetCodes(req, res);
    case 'reset-votes': return await resetVotes(req, res);
    case 'clear-data': return await clearData(req, res);
    case 'clear-students': return await clearStudents(req, res);
    default: return res.status(404).json({ error: 'Sub-endpoint no encontrado' });
  }
}

// NUEVO: Cambiar modo de elección
async function handleElectionMode(req, res) {
  const supabase = getSupabase();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { mode } = req.body || {};
  if (!['personero', 'contralor', 'ambos'].includes(mode)) {
    return res.status(400).json({ error: 'Modo inválido. Valores permitidos: personero, contralor, ambos' });
  }

  // Solo se puede cambiar si la votación está cerrada
  const { data: config } = await supabase.from('config').select('election_status').eq('id', 1).single();
  if (config?.election_status === 'open') {
    return res.status(400).json({ error: 'No se puede cambiar el modo mientras la votación está abierta' });
  }

  const { error } = await supabase.from('config').update({ election_mode: mode }).eq('id', 1);
  if (error) return res.status(500).json({ error: 'Error al cambiar modo de elección' });
  return res.status(200).json({ success: true, mode });
}

// NUEVO: Cambiar flujo de votación (para modo 'ambos')
async function handleVotingFlow(req, res) {
  const supabase = getSupabase();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { flow } = req.body || {};
  if (!['sequential', 'simultaneous'].includes(flow)) {
    return res.status(400).json({ error: 'Flujo inválido. Valores: sequential, simultaneous' });
  }

  const { data: config } = await supabase.from('config').select('election_status').eq('id', 1).single();
  if (config?.election_status === 'open') {
    return res.status(400).json({ error: 'No se puede cambiar el flujo mientras la votación está abierta' });
  }

  const { error } = await supabase.from('config').update({ voting_flow: flow }).eq('id', 1);
  if (error) return res.status(500).json({ error: 'Error al cambiar flujo' });
  return res.status(200).json({ success: true, flow });
}

async function handleStudents(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, grade, course, list_number, access_code, has_voted, voted_personero, voted_contralor')
      .order('grade').order('course').order('list_number');
    if (error) return res.status(500).json({ error: 'Error al cargar estudiantes' });
    return res.status(200).json({ students: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requerido' });
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Error al eliminar' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

async function handleCandidates(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('candidates').select('*').order('sort_order', { ascending: true, nullsFirst: false }).order('name');
    if (error) return res.status(500).json({ error: 'Error al cargar candidatos' });
    return res.status(200).json({ candidates: data });
  }

  if (req.method === 'POST') {
    const { name, party, photo_url, role } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const candidateRole = ['personero', 'contralor'].includes(role) ? role : 'personero';

    const { data, error } = await supabase
      .from('candidates')
      .insert([{ name, party: party || '', photo_url: photo_url || '', role: candidateRole }])
      .select().single();
    if (error) return res.status(500).json({ error: 'Error al crear candidato' });
    return res.status(200).json({ candidate: data });
  }

  if (req.method === 'PUT') {
    const { id, photo_url, name, party, sort_order, role } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    const updates = {};
    if (photo_url !== undefined) updates.photo_url = photo_url;
    if (name !== undefined && name.trim() !== '') updates.name = name.trim();
    if (party !== undefined) updates.party = party.trim();
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (role && ['personero', 'contralor'].includes(role)) updates.role = role;

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });

    const { error } = await supabase.from('candidates').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: 'Error al actualizar candidato' });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requerido' });
    await supabase.from('votes').delete().eq('candidate_id', id);
    const { error } = await supabase.from('candidates').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Error al eliminar' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

async function handleElection(req, res) {
  const supabase = getSupabase();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { action } = req.body || {};
  if (!['open', 'close'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });

  const { error } = await supabase.from('config').update({ election_status: action === 'open' ? 'open' : 'closed' }).eq('id', 1);
  if (error) return res.status(500).json({ error: 'Error al cambiar estado' });
  return res.status(200).json({ success: true, status: action === 'open' ? 'open' : 'closed' });
}

function makeAccessCode(grade, course, list) {
  return `${String(grade).padStart(2, '0')}${course}${String(list).padStart(2, '0')}`;
}

async function importStudents(req, res) {
  const supabase = getSupabase();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { students } = req.body || {};
  if (!Array.isArray(students)) return res.status(400).json({ error: 'Formato inválido: se esperaba un array de estudiantes' });
  if (students.length === 0) return res.status(400).json({ error: 'No hay estudiantes para importar' });

  const validStudents = [];
  students.forEach((s) => {
    const nombre = s.full_name;
    const grado = parseInt(s.grade, 10);
    const curso = parseInt(s.course, 10) || 1;
    if (!nombre || isNaN(grado) || grado < 0) return;
    if (curso < 1 || curso > 9) return;
    validStudents.push({ full_name: String(nombre).trim(), grade: grado, course: curso });
  });

  if (validStudents.length === 0) return res.status(400).json({ error: 'No hay estudiantes válidos para importar' });

  const { data: existing, error: fetchError } = await supabase.from('students').select('full_name, grade, course, list_number, access_code');
  if (fetchError) return res.status(500).json({ error: 'Error al consultar estudiantes existentes', details: fetchError.message });

  const usedCodes = new Set();
  const maxListPerGroup = {};
  const existingStudentKeys = new Set();

  for (const s of (existing || [])) {
    if (s.access_code) usedCodes.add(String(s.access_code));
    const key = `${s.grade}-${s.course}`;
    if ((s.list_number || 0) > (maxListPerGroup[key] || 0)) maxListPerGroup[key] = s.list_number;
    existingStudentKeys.add(`${String(s.full_name).trim().toLowerCase()}|${s.grade}|${s.course}`);
  }

  let skipped = 0;
  const newStudents = validStudents.filter(s => {
    const k = `${s.full_name.toLowerCase()}|${s.grade}|${s.course}`;
    if (existingStudentKeys.has(k)) { skipped++; return false; }
    return true;
  });

  if (newStudents.length === 0) {
    return res.status(200).json({ success: true, imported: 0, skipped, total: students.length, valid: 0, groups: 0, message: 'Todos los estudiantes ya estaban registrados', errors: [], hasErrors: false });
  }

  const groups = {};
  for (const s of newStudents) {
    const key = `${s.grade}-${s.course}`;
    if (!groups[key]) groups[key] = { grade: s.grade, course: s.course, students: [] };
    groups[key].students.push(s);
  }

  const toInsert = [];
  for (const group of Object.values(groups)) {
    const key = `${group.grade}-${group.course}`;
    let nextList = (maxListPerGroup[key] || 0) + 1;
    for (const student of group.students) {
      while (nextList <= 99 && usedCodes.has(makeAccessCode(group.grade, group.course, nextList))) nextList++;
      if (nextList > 99) continue;
      const accessCode = makeAccessCode(group.grade, group.course, nextList);
      usedCodes.add(accessCode);
      toInsert.push({ full_name: student.full_name, grade: group.grade, course: group.course, list_number: nextList, access_code: accessCode });
      nextList++;
    }
  }

  if (toInsert.length === 0) return res.status(400).json({ error: 'No se pudieron asignar códigos disponibles' });

  let inserted = 0;
  const insertErrors = [];

  for (const student of toInsert) {
    const { error } = await supabase.from('students').insert(student);
    if (error) {
      if (error.code === '23505') {
        const key = `${student.grade}-${student.course}`;
        let retryList = student.list_number + 1;
        let retried = false;
        while (retryList <= 99) {
          const retryCode = makeAccessCode(student.grade, student.course, retryList);
          if (!usedCodes.has(retryCode)) {
            const { error: retryError } = await supabase.from('students').insert({ ...student, list_number: retryList, access_code: retryCode });
            if (!retryError) { usedCodes.add(retryCode); inserted++; retried = true; break; }
          }
          retryList++;
        }
        if (!retried) insertErrors.push(`${student.full_name}: sin código disponible`);
      } else {
        insertErrors.push(`${student.full_name}: ${error.message}`);
      }
    } else {
      inserted++;
    }
  }

  return res.status(200).json({ success: inserted > 0 || skipped > 0, imported: inserted, skipped, total: students.length, valid: toInsert.length, groups: Object.keys(groups).length, errors: insertErrors.slice(0, 10), hasErrors: insertErrors.length > 0 });
}

async function resetCodes(req, res) {
  const supabase = getSupabase();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { data: students, error: fetchError } = await supabase.from('students').select('id, grade, course, list_number');
  if (fetchError) return res.status(500).json({ error: 'Error al cargar estudiantes' });

  let updated = 0;
  for (const student of students) {
    const newCode = `${String(student.grade).padStart(2, '0')}${student.course}${String(student.list_number).padStart(2, '0')}`;
    const { error } = await supabase.from('students').update({ access_code: newCode }).eq('id', student.id);
    if (!error) updated++;
  }
  return res.status(200).json({ success: true, message: `${updated} códigos regenerados` });
}

async function resetVotes(req, res) {
  const supabase = getSupabase();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { error: studentsError } = await supabase.from('students')
      .update({ has_voted: false, voted_personero: false, voted_contralor: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (studentsError) return res.status(500).json({ error: 'Error al restablecer estudiantes', details: studentsError.message });

    const { error: candidatesError } = await supabase.from('candidates').update({ votes: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (candidatesError) return res.status(500).json({ error: 'Error al restablecer candidatos', details: candidatesError.message });

    await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    return res.status(200).json({ success: true, message: 'Votación restablecida correctamente.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno al restablecer votación', details: err.message });
  }
}

async function clearData(req, res) {
  const supabase = getSupabase();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { confirm } = req.body || {};
  if (confirm !== 'ELIMINAR TODO') return res.status(400).json({ error: 'Confirmación requerida' });

  await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('candidates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('config').update({ election_status: 'closed' }).eq('id', 1);

  return res.status(200).json({ success: true, message: 'Datos eliminados' });
}

async function clearStudents(req, res) {
  const supabase = getSupabase();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  return res.status(200).json({ success: true, message: 'Estudiantes eliminados' });
}

// =====================================================
// STATS / MONITOR / RESULTS
// =====================================================

async function getStats(req, res) {
  const supabase = getSupabase();
  const adminCode = req.headers['x-admin-code'];
  const { data: config } = await supabase.from('config').select('admin_code, election_mode').eq('id', 1).single();
  if (!config || adminCode !== config.admin_code) return res.status(401).json({ error: 'No autorizado' });

  const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true });
  const { count: votedStudents } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('has_voted', true);
  const { data: totalVotes } = await supabase.from('candidates').select('votes');
  const sumVotes = totalVotes?.reduce((a, b) => a + (b.votes || 0), 0) || 0;
  const { data: byGrade } = await supabase.from('participation_by_grade').select('*');
  const { data: results } = await supabase.from('election_results').select('*');

  return res.status(200).json({
    general: {
      totalStudents: totalStudents || 0,
      totalVoted: votedStudents || 0,
      totalVotes: sumVotes,
      participation: (totalStudents || 0) > 0 ? Math.round(((votedStudents || 0) / totalStudents) * 100) : 0
    },
    byGrade: byGrade || [],
    results: results || [],
    election_mode: config.election_mode || 'personero'
  });
}

async function getMonitorData(req, res) {
  const supabase = getSupabase();
  const adminCode = req.headers['x-admin-code'];
  const { data: config } = await supabase.from('config').select('admin_code').eq('id', 1).single();
  if (!config || adminCode !== config.admin_code) return res.status(401).json({ error: 'No autorizado' });

  try {
    const { data: students } = await supabase.from('students').select('grade, course, has_voted').order('grade').order('course');
    const monitorData = {};
    students.forEach(s => {
      const key = `${s.grade}-${s.course}`;
      if (!monitorData[key]) monitorData[key] = { grade: s.grade, course: s.course, total: 0, voted: 0 };
      monitorData[key].total++;
      if (s.has_voted) monitorData[key].voted++;
    });

    const courses = Object.values(monitorData).map(c => ({ ...c, pending: c.total - c.voted, participation: c.total > 0 ? Math.round((c.voted / c.total) * 100) : 0 }));

    const gradeSummary = {};
    courses.forEach(c => {
      if (!gradeSummary[c.grade]) gradeSummary[c.grade] = { grade: c.grade, total: 0, voted: 0 };
      gradeSummary[c.grade].total += c.total;
      gradeSummary[c.grade].voted += c.voted;
    });

    const grades = Object.values(gradeSummary).map(g => ({ ...g, pending: g.total - g.voted, participation: g.total > 0 ? Math.round((g.voted / g.total) * 100) : 0 })).sort((a, b) => a.grade - b.grade);
    const totalGeneral = grades.reduce((acc, g) => ({ total: acc.total + g.total, voted: acc.voted + g.voted }), { total: 0, voted: 0 });

    return res.status(200).json({
      courses: courses.sort((a, b) => a.grade - b.grade || a.course - b.course),
      grades,
      summary: { total: totalGeneral.total, voted: totalGeneral.voted, pending: totalGeneral.total - totalGeneral.voted, participation: totalGeneral.total > 0 ? Math.round((totalGeneral.voted / totalGeneral.total) * 100) : 0 },
      lastUpdate: new Date().toLocaleTimeString()
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener datos de monitoreo' });
  }
}

async function getFinalResults(req, res) {
  const supabase = getSupabase();

  try {
    const { data: config } = await supabase.from('config').select('election_mode').eq('id', 1).single();
    const mode = config?.election_mode || 'personero';

    const { data: allCandidates } = await supabase.from('candidates').select('id, name, party, photo_url, votes, role').order('votes', { ascending: false });
    const sumVotes = allCandidates?.reduce((a, b) => a + (b.votes || 0), 0) || 0;

    if (sumVotes === 0) {
      return res.status(200).json({ message: 'No hay votos registrados aún', results: [], personero: [], contralor: [], totalVotes: 0, totalStudents: 0, participation: 0, election_mode: mode });
    }

    const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true });
    const { count: votedStudents } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('has_voted', true);

    // Separar por rol
    const personeroResults = (allCandidates || []).filter(c => !c.role || c.role === 'personero').sort((a, b) => b.votes - a.votes);
    const contraloristaResults = (allCandidates || []).filter(c => c.role === 'contralor').sort((a, b) => b.votes - a.votes);

    const getWinners = (arr) => {
      const max = Math.max(...arr.map(r => r.votes));
      return arr.filter(r => r.votes === max && r.votes > 0);
    };

    return res.status(200).json({
      results: allCandidates || [],
      personero: personeroResults,
      contralor: contraloristaResults,
      totalVotes: sumVotes,
      totalStudents: totalStudents || 0,
      totalVoted: votedStudents || 0,
      participation: (totalStudents || 0) > 0 ? Math.round(((votedStudents || 0) / totalStudents) * 100) : 0,
      winners: getWinners(personeroResults),
      winnersContralor: getWinners(contraloristaResults),
      isTie: getWinners(personeroResults).length > 1,
      isTieContralor: getWinners(contraloristaResults).length > 1,
      election_mode: mode,
      electionClosed: true
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener resultados' });
  }
}
