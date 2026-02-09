// ============================================
// PANEL DE ADMINISTRACIÓN - FRONTEND
// ============================================

const API_URL = '/api';

let adminCode = localStorage.getItem('admin_code') || ''; // Solo para UI
let studentsData = [];
let candidatesData = [];
let excelData = [];

// Auto-rellenar campo si ya había un código guardado
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('admin-code');
    if (input && adminCode) input.value = adminCode;

    document.getElementById('excel-file')?.addEventListener('change', handleFileSelect);
});

// =========================
// LOGIN
// =========================

async function login() {
    const code = document.getElementById('admin-code').value.trim();
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = '';

    try {
        const res = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-code': code
            },
            body: JSON.stringify({ admin_code: code })
        });

        if (res.ok) {
            adminCode = code;
            localStorage.setItem('admin_code', code);

            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('admin-container').style.display = 'block';

            await loadDashboard();
        } else {
            errorDiv.textContent = 'Código incorrecto';
        }
    } catch (err) {
        errorDiv.textContent = 'Error de conexión';
    }
}

// =========================
// NAVEGACIÓN
// =========================

function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.admin-nav button').forEach(b => b.classList.remove('active'));

    document.getElementById(`sec-${section}`).classList.add('active');
    event.target.classList.add('active');

    if (section === 'dashboard') loadDashboard();
    if (section === 'students') loadStudents();
    if (section === 'candidates') loadCandidates();
}

// =========================
// DASHBOARD
// =========================

async function loadDashboard() {
    try {
        const res = await fetch(`${API_URL}/stats`, {
            headers: { 'x-admin-code': adminCode }
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error al cargar estadísticas');

        // Stats generales
        document.getElementById('stat-total').textContent = data.general.totalStudents;
        document.getElementById('stat-voted').textContent = data.general.totalVoted;
        document.getElementById('stat-participation').textContent = data.general.participation + '%';
        document.getElementById('stat-candidates').textContent = data.results?.length || 0;

        // Por grado
        const gradeContainer = document.getElementById('grade-stats');
        gradeContainer.innerHTML = (data.byGrade || []).map(g => `
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <span>Grado ${g.grade}°</span>
                    <span>${g.voted}/${g.total_students} (${g.participation_percent}%)</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${g.participation_percent}%"></div>
                </div>
            </div>
        `).join('');

        // Resultados
        const resultsContainer = document.getElementById('results-list');

        if (data.results && data.results.length > 0) {
            const maxVotes = Math.max(...data.results.map(r => r.votes));

            resultsContainer.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Candidato</th>
                            <th>Partido</th>
                            <th>Votos</th>
                            <th>%</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.results.map(r => `
                            <tr style="${r.votes === maxVotes && r.votes > 0 ? 'background: #ecfdf5;' : ''}">
                                <td><strong>${r.name}</strong></td>
                                <td>${r.party || '-'}</td>
                                <td>${r.votes}</td>
                                <td>${r.percentage}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            resultsContainer.innerHTML = '<p>No hay candidatos registrados</p>';
        }

        // Estado elección
        await refreshElectionStatus();

    } catch (err) {
        console.error('Error cargando dashboard:', err);
    }
}

async function refreshElectionStatus() {
    try {
        const res = await fetch(`${API_URL}/check-status`);
        const data = await res.json();
        updateElectionButton(data.open);
    } catch {}
}

// =========================
// ABRIR / CERRAR VOTACIÓN
// =========================

async function toggleElection() {
    const btn = document.getElementById('btn-toggle');
    const wantsOpen = btn.textContent.includes('Abrir');

    try {
        const res = await fetch(`${API_URL}/admin/election`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-code': adminCode
            },
            body: JSON.stringify({
                action: wantsOpen ? 'open' : 'close',
                admin_code: adminCode
            })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error');

        updateElectionButton(wantsOpen);
    } catch (err) {
        alert('Error al cambiar estado: ' + err.message);
    }
}

function updateElectionButton(isOpen) {
    const btn = document.getElementById('btn-toggle');
    const status = document.getElementById('election-status');

    if (isOpen) {
        btn.textContent = 'Cerrar Votación';
        btn.className = 'btn btn-danger';
        status.textContent = 'Estado: Abierta';
        status.style.color = 'var(--success)';
    } else {
        btn.textContent = 'Abrir Votación';
        btn.className = 'btn btn-primary';
        status.textContent = 'Estado: Cerrada';
        status.style.color = 'var(--gray-600)';
    }
}

// =========================
// ESTUDIANTES
// =========================

async function loadStudents() {
    try {
        const res = await fetch(`${API_URL}/admin/students`, {
            headers: { 'x-admin-code': adminCode }
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error al cargar estudiantes');

        studentsData = data.students || [];

        const container = document.getElementById('students-table-container');

        if (studentsData.length === 0) {
            container.innerHTML = '<p>No hay estudiantes registrados</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Grado</th>
                        <th>Curso</th>
                        <th>Lista</th>
                        <th>Estado</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${studentsData.map(s => `
                        <tr>
                            <td><code>${s.access_code}</code></td>
                            <td>${s.full_name}</td>
                            <td>${s.grade}°</td>
                            <td>${s.course}</td>
                            <td>${s.list_number}</td>
                            <td>${s.has_voted ? '✓ Votó' : 'Pendiente'}</td>
                            <td>
                                <button onclick="deleteStudent('${s.id}')" class="btn btn-danger btn-small">
                                    Eliminar
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error('Error cargando estudiantes:', err);
    }
}

async function deleteStudent(id) {
    if (!confirm('¿Eliminar este estudiante?')) return;

    try {
        const res = await fetch(`${API_URL}/admin/students`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-code': adminCode
            },
            body: JSON.stringify({ id, admin_code: adminCode })
        });

        if (res.ok) loadStudents();
    } catch (err) {
        alert('Error al eliminar');
    }
}

async function resetCodes() {
    if (!confirm('¿Regenerar todos los códigos? Esto puede tomar un momento.')) return;

    try {
        const res = await fetch(`${API_URL}/admin/reset-codes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-code': adminCode
            },
            body: JSON.stringify({ admin_code: adminCode })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error');

        alert(data.message || 'Códigos regenerados');
        loadStudents();
    } catch (err) {
        alert('Error al regenerar códigos: ' + err.message);
    }
}

async function clearAllData() {
    const confirmText = prompt('Escribe ELIMINAR TODO para confirmar la eliminación de TODOS los datos:');
    if (confirmText !== 'ELIMINAR TODO') return;

    try {
        const res = await fetch(`${API_URL}/admin/clear-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-code': adminCode
            },
            body: JSON.stringify({ confirm: 'ELIMINAR TODO', admin_code: adminCode })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error');

        alert('Todos los datos han sido eliminados');
        location.reload();
    } catch (err) {
        alert('Error al eliminar datos: ' + err.message);
    }
}

// =========================
// CANDIDATOS
// =========================

async function loadCandidates() {
    try {
        const res = await fetch(`${API_URL}/admin/candidates`, {
            headers: { 'x-admin-code': adminCode }
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error al cargar candidatos');

        candidatesData = data.candidates || [];

        const container = document.getElementById('candidates-list-admin');

        if (candidatesData.length === 0) {
            container.innerHTML = '<p>No hay candidatos registrados</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Partido/Lista</th>
                        <th>Votos</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${candidatesData.map(c => `
                        <tr>
                            <td>${c.name}</td>
                            <td>${c.party || '-'}</td>
                            <td>${c.votes}</td>
                            <td>
                                <button onclick="deleteCandidate('${c.id}')" class="btn btn-danger btn-small">
                                    Eliminar
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error('Error cargando candidatos:', err);
    }
}

async function addCandidate() {
    const name = document.getElementById('new-candidate-name').value.trim();
    const party = document.getElementById('new-candidate-party').value.trim();

    if (!name) {
        alert('Ingresa un nombre');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/candidates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-code': adminCode
            },
            body: JSON.stringify({ name, party, admin_code: adminCode })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error');

        document.getElementById('new-candidate-name').value = '';
        document.getElementById('new-candidate-party').value = '';

        loadCandidates();
    } catch (err) {
        alert('Error al agregar candidato: ' + err.message);
    }
}

async function deleteCandidate(id) {
    if (!confirm('¿Eliminar este candidato? Se perderán los votos asociados.')) return;

    try {
        const res = await fetch(`${API_URL}/admin/candidates`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-code': adminCode
            },
            body: JSON.stringify({ id, admin_code: adminCode })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error');

        loadCandidates();
    } catch (err) {
        alert('Error al eliminar: ' + err.message);
    }
}

// =========================
// IMPORTAR EXCEL (SheetJS)
// =========================

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('file-name').textContent = file.name;

    const reader = new FileReader();

    reader.onload = function(ev) {
        try {
            const data = new Uint8Array(ev.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            processExcelData(jsonData);
        } catch (err) {
            alert('Error al leer el archivo: ' + err.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

function processExcelData(data) {
    const mapped = data.map((row, index) => {
        const keys = Object.keys(row);

        const nameKey = keys.find(k =>
            k.toLowerCase().includes('nombre') ||
            k.toLowerCase().includes('name') ||
            k.toLowerCase().includes('estudiante')
        );

        const gradeKey = keys.find(k =>
            k.toLowerCase().includes('grado') ||
            k.toLowerCase().includes('grade') ||
            k.toLowerCase().includes('nivel')
        );

        const courseKey = keys.find(k =>
            k.toLowerCase().includes('curso') ||
            k.toLowerCase().includes('paralelo') ||
            k.toLowerCase().includes('sección') ||
            k.toLowerCase().includes('seccion') ||
            k.toLowerCase().includes('course') ||
            k.toLowerCase().includes('aula')
        );

        const listKey = keys.find(k =>
            k.toLowerCase().includes('lista') ||
            k.toLowerCase().includes('número') ||
            k.toLowerCase().includes('numero') ||
            k.toLowerCase().includes('list')
        );

        return {
            full_name: row[nameKey] || '',
            grade: parseInt(row[gradeKey]) || 0,
            course: parseInt(row[courseKey]) || 0,
            list_number: parseInt(row[listKey]) || (index + 1),
            raw: row
        };
    }).filter(s => s.full_name && s.grade > 0 && s.course > 0);

    excelData = mapped;

    const preview = document.getElementById('import-preview');
    preview.innerHTML = `
        <p><strong>${mapped.length} estudiantes válidos encontrados:</strong></p>
        <table style="margin-top: 0.5rem; font-size: 0.875rem;">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Grado</th>
                    <th>Curso</th>
                    <th>Lista</th>
                    <th>Código</th>
                </tr>
            </thead>
            <tbody>
                ${mapped.slice(0, 5).map(s => `
                    <tr>
                        <td>${s.full_name}</td>
                        <td>${s.grade}</td>
                        <td>${s.course}</td>
                        <td>${s.list_number}</td>
                        <td><code>${s.grade}${s.course}${String(s.list_number).padStart(2, '0')}</code></td>
                    </tr>
                `).join('')}
                ${mapped.length > 5 ? `<tr><td colspan="5">... y ${mapped.length - 5} más</td></tr>` : ''}
            </tbody>
        </table>
    `;

    document.getElementById('btn-import').style.display = 'block';
}

async function importStudents() {
    if (excelData.length === 0) return;

    const btn = document.getElementById('btn-import');
    btn.disabled = true;
    btn.textContent = 'Importando...';

    try {
        const res = await fetch(`${API_URL}/admin/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-code': adminCode
            },
            body: JSON.stringify({
                students: excelData,
                admin_code: adminCode
            })
        });

        const result = await res.json();

        if (!res.ok) throw new Error(result.error || 'Error al importar');

        const resultDiv = document.getElementById('import-result');
        resultDiv.innerHTML = `
            <div class="card" style="margin-top: 1rem; background: ${result.errors ? '#fef3c7' : '#ecfdf5'};">
                <p><strong>Importados:</strong> ${result.imported} de ${result.total}</p>
                ${result.errors ? `<p style="color: #92400e;"><strong>Errores:</strong> ${result.errors.length}</p>` : ''}
            </div>
        `;

        if (result.imported > 0) {
            excelData = [];
            document.getElementById('btn-import').style.display = 'none';
            document.getElementById('excel-file').value = '';
        }

    } catch (err) {
        alert('Error al importar: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Importar Estudiantes';
    }
}
