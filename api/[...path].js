import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-code');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ✅ Router robusto (Vercel a veces NO llena req.query.path)
  const url = new URL(req.url, `http://${req.headers.host}`);
  let parts = Array.isArray(req.query.path)
    ? req.query.path
    : (typeof req.query.path === 'string' ? [req.query.path] : []);

  // Fallback: parsear desde la URL
  if (!parts || parts.length === 0) {
    const rawPath = url.pathname || '';
    const cleaned = rawPath.startsWith('/api/') ? rawPath.slice(5) : rawPath.replace(/^\/+/, '');
    parts = cleaned.split('/').filter(Boolean);
  }

  const endpoint = parts[0] || '';
  const subEndpoint = parts[1] || '';

  try {
    switch (endpoint) {
      case 'health':
        return res.status(200).json({ ok: true });

      case 'check-status':
        return await checkStatus(req, res);

      case 'verify-code':
        return await verifyCode(req, res);

      case 'cast-vote':
        return await castVote(req, res);

      case 'get-candidates':
        return await getCandidates(req, res);

      case 'admin':
        return await handleAdmin(req, res, subEndpoint);

      case 'stats':
        return await getStats(req, res);

      case 'config':
        return await handleConfig(req, res);

      case 'results':
        return await getFinalResults(req, res);

      case 'monitor':
        return await getMonitorData(req, res);

      default:
        return res.status(404).json({
          error: 'Endpoint no encontrado',
          endpoint,
          subEndpoint,
          parts,
          pathname: url.pathname
        });
    }
  } catch (error) {
    console.error('Error handler:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function checkStatus(req, res) {
  const { data, error } = await supabase
    .from('config')
    .select('election_status, school_logo_url, school_name')
    .eq('id', 1)
    .single();

  if (error) return res.status(500).json({ error: 'Error al consultar estado' });

  return res.status(200).json({
    open: data.election_status === 'open',
    status: data.election_status,
    school_logo: data.school_logo_url,
    school_name: data.school_name
  });
}

async function verifyCode(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { access_code } = req.body || {};
  if (!access_code || !/^\d{5}$/.test(access_code)) {
    return res.status(400).json({ error: 'Código inválido (debe tener 5 dígitos)' });
  }

  const { data: student, error } = await supabase
    .from('students')
    .select('id, full_name, grade, course, has_voted')
    .eq('access_code', access_code)
    .single();

  if (error || !student) return res.status(404).json({ error: 'Código no encontrado' });
  if (student.has_voted) return res.status(403).json({ error: 'Este código ya ha sido utilizado' });

  return res.status(200).json({
    valid: true,
    student: { name: student.full_name, grade: student.grade, course: student.course }
  });
}

async function castVote(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { access_code, candidate_id } = req.body || {};
  if (!access_code || !candidate_id) return res.status(400).json({ error: 'Datos incompletos' });

  const { data, error } = await supabase.rpc('cast_vote', {
    p_access_code: access_code,
    p_candidate_id: candidate_id
  });

  if (error) return res.status(500).json({ error: 'Error al procesar voto', details: error.message });

  const result = data;
  if (!result.success) return res.status(400).json({ error: result.error });

  return res.status(200).json({
    success: true,
    message: 'Voto registrado correctamente',
    student: result.student
  });
}

async function getCandidates(req, res) {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, name, party, photo_url')
    .order('name');

  if (error) return res.status(500).json({ error: 'Error al cargar candidatos' });
  return res.status(200).json({ candidates: data });
}

async function handleConfig(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('config')
      .select('school_logo_url, school_name')
      .eq('id', 1)
      .single();

    if (error) return res.status(500).json({ error: 'Error' });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const adminCode = req.headers['x-admin-code'];
    const { data: config } = await supabase.from('config').select('admin_code').eq('id', 1).single();
    if (!config || adminCode !== config.admin_code) return res.status(401).json({ error: 'No autorizado' });

    const { school_logo_url, school_name } = req.body || {};
    const { error } = await supabase
      .from('config')
      .update({
        school_logo_url: school_logo_url || null,
        school_name: school_name || 'Colegio'
      })
      .eq('id', 1);

    if (error) return res.status(500).json({ error: 'Error al actualizar' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

async function getFinalResults(req, res) {
  try {
    const { data: totalVotes } = await supabase.from('candidates').select('votes');
    const sumVotes = totalVotes?.reduce((a, b) => a + (b.votes || 0), 0) || 0;

    if (sumVotes === 0) {
      return res.status(200).json({
        message: 'No hay votos registrados aún',
        results: [],
        totalVotes: 0,
        totalStudents: 0,
        participation: 0
      });
    }

    const { data: results } = await supabase.from('election_results').select('*');
    const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true });
    const { count: votedStudents } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('has_voted', true);

    const maxVotes = Math.max(...results.map(r => r.votes));
    const winners = results.filter(r => r.votes === maxVotes && r.votes > 0);

    return res.status(200).json({
      results: results || [],
      totalVotes: sumVotes,
      totalStudents: totalStudents || 0,
      totalVoted: votedStudents || 0,
      participation: (totalStudents || 0) > 0 ? Math.round(((votedStudents || 0) / totalStudents) * 100) : 0,
      winners,
      isTie: winners.length > 1,
      electionClosed: true
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener resultados' });
  }
}

async function getMonitorData(req, res) {
  const adminCode = req.headers['x-admin-code'];
  const { data: config } = await supabase.from('config').select('admin_code').eq('id', 1).single();
  if (!config || adminCode !== config.admin_code) return res.status(401).json({ error: 'No autorizado' });

  try {
    const { data: students } = await supabase
      .from('students')
      .select('grade, course, has_voted')
      .order('grade')
      .order('course');

    const monitorData = {};
    students.forEach(s => {
      const key = `${s.grade}-${s.course}`;
      if (!monitorData[key]) monitorData[key] = { grade: s.grade, course: s.course, total: 0, voted: 0 };
      monitorData[key].total++;
      if (s.has_voted) monitorData[key].voted++;
    });

    const courses = Object.values(monitorData).map(c => ({
      ...c,
      pending: c.total - c.voted,
      participation: c.total > 0 ? Math.round((c.voted / c.total) * 100) : 0
    }));

    const gradeSummary = {};
    courses.forEach(c => {
      if (!gradeSummary[c.grade]) gradeSummary[c.grade] = { grade: c.grade, total: 0, voted: 0 };
      gradeSummary[c.grade].total += c.total;
      gradeSummary[c.grade].voted += c.voted;
    });

    const grades = Object.values(gradeSummary).map(g => ({
      ...g,
      pending: g.total - g.voted,
      participation: g.total > 0 ? Math.round((g.voted / g.total) * 100) : 0
    })).sort((a, b) => a.grade - b.grade);

    const totalGeneral = grades.reduce((acc, g) => ({ total: acc.total + g.total, voted: acc.voted + g.voted }), { total: 0, voted: 0 });

    return res.status(200).json({
      courses: courses.sort((a, b) => a.grade - b.grade || a.course - b.course),
      grades,
      summary: {
        total: totalGeneral.total,
        voted: totalGeneral.voted,
        pending: totalGeneral.total - totalGeneral.voted,
        participation: totalGeneral.total > 0 ? Math.round((totalGeneral.voted / totalGeneral.total) * 100) : 0
      },
      lastUpdate: new Date().toLocaleTimeString()
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener datos de monitoreo' });
  }
}

async function handleAdmin(req, res, subEndpoint) {
  const adminCode = req.headers['x-admin-code'] || req.body?.admin_code;

  const { data: config, error: cfgErr } = await supabase.from('config').select('admin_code').eq('id', 1).single();
  if (cfgErr) return res.status(500).json({ error: 'Error leyendo config', details: cfgErr.message });
  if (!config || adminCode !== config.admin_code) return res.status(401).json({ error: 'Código de administrador inválido' });

  switch (subEndpoint) {
    case 'login': return res.status(200).json({ success: true });
    case 'students': return await handleStudents(req, res);
    case 'candidates': return await handleCandidates(req, res);
    case 'election': return await handleElection(req, res);
    case 'import': return await importStudents(req, res);
    case 'reset-codes': return await resetCodes(req, res);
    case 'clear-data': return await clearData(req, res);
    default: return res.status(404).json({ error: 'Sub-endpoint no encontrado', subEndpoint });
  }
}

async function handleStudents(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, grade, course, list_number, access_code, has_voted')
      .order('grade')
      .order('course')
      .order('list_number');

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
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('candidates').select('*').order('name');
    if (error) return res.status(500).json({ error: 'Error al cargar candidatos' });
    return res.status(200).json({ candidates: data });
  }

  if (req.method === 'POST') {
    const { name, party, photo_url } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });

    const { data, error } = await supabase
      .from('candidates')
      .insert([{ name, party: party || '', photo_url: photo_url || '' }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Error al crear candidato' });
    return res.status(200).json({ candidate: data });
  }

  if (req.method === 'PUT') {
    const { id, photo_url } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    const { error } = await supabase.from('candidates').update({ photo_url }).eq('id', id);
    if (error) return res.status(500).json({ error: 'Error al actualizar foto' });

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { action } = req.body || {};
  if (!['open', 'close'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });

  const { error } = await supabase
    .from('config')
    .update({ election_status: action === 'open' ? 'open' : 'closed' })
    .eq('id', 1);

  if (error) return res.status(500).json({ error: 'Error al cambiar estado' });
  return res.status(200).json({ success: true, status: action === 'open' ? 'open' : 'closed' });
}

// Importa y genera códigos GGCLL (ej: 06105)
async function importStudents(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { students } = req.body || {};
  if (!Array.isArray(students)) return res.status(400).json({ error: 'Formato inválido: se esperaba un array' });
  if (students.length === 0) return res.status(400).json({ error: 'No hay estudiantes para importar' });

  const grouped = {};
  students.forEach((s) => {
    const nombre = s.full_name;
    const grado = parseInt(s.grade, 10);
    const curso = parseInt(s.course, 10) || 1;

    if (!nombre || !grado || isNaN(grado)) return;
    if (curso < 1 || curso > 9) return;

    const key = `${grado}-${curso}`;
    if (!grouped[key]) grouped[key] = { grade: grado, course: curso, students: [] };
    grouped[key].students.push({ full_name: String(nombre).trim(), grade: grado, course: curso });
  });

  const rows = [];
  for (const group of Object.values(grouped)) {
    group.students.forEach((student, idx) => {
      const listNumber = idx + 1;
      const accessCode =
        `${String(student.grade).padStart(2, '0')}` +
        `${student.course}` +
        `${String(listNumber).padStart(2, '0')}`;

      rows.push({
        full_name: student.full_name,
        grade: student.grade,
        course: student.course,
        list_number: listNumber,
        access_code: accessCode
      });
    });
  }

  const batchSize = 50;
  let inserted = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await supabase.from('students').insert(batch).select('id');
    if (error) {
      for (const r of batch) {
        const { error: e } = await supabase.from('students').insert(r);
        if (e) errors.push(`${r.full_name}: ${e.message}`);
        else inserted++;
      }
    } else {
      inserted += (data || []).length;
    }
  }

  return res.status(200).json({
    success: true,
    imported: inserted,
    valid: rows.length,
    errors: errors.slice(0, 10),
    hasErrors: errors.length > 0,
    groups: Object.keys(grouped).length
  });
}

async function resetCodes(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { data: students, error: fetchError } = await supabase.from('students').select('id, grade, course, list_number');
  if (fetchError) return res.status(500).json({ error: 'Error al cargar estudiantes' });

  let updated = 0;
  for (const s of students) {
    const newCode =
      `${String(s.grade).padStart(2, '0')}` +
      `${s.course}` +
      `${String(s.list_number).padStart(2, '0')}`;

    const { error } = await supabase.from('students').update({ access_code: newCode }).eq('id', s.id);
    if (!error) updated++;
  }

  return res.status(200).json({ success: true, message: `${updated} códigos regenerados` });
}

async function clearData(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { confirm } = req.body || {};
  if (confirm !== 'ELIMINAR TODO') return res.status(400).json({ error: 'Confirmación requerida' });

  await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('candidates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('config').update({ election_status: 'closed' }).eq('id', 1);

  return res.status(200).json({ success: true, message: 'Datos eliminados' });
}

async function getStats(req, res) {
  const adminCode = req.headers['x-admin-code'];
  const { data: config } = await supabase.from('config').select('admin_code').eq('id', 1).single();
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
    results: results || []
  });
}
