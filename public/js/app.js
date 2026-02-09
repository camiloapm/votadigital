// ============================================
// APP DE VOTACIÓN - FRONTEND
// ============================================

const API_URL = '/api';
let currentStudent = null;
let selectedCandidate = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkElectionStatus();

    document.getElementById('btn-verify').addEventListener('click', verifyCode);
    document.getElementById('access-code').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verifyCode();
    });

    document.getElementById('btn-back').addEventListener('click', () => showStep('step-verify'));
    document.getElementById('btn-continue').addEventListener('click', () => showStep('step-vote'));
    document.getElementById('btn-cast').addEventListener('click', castVote);
});

async function checkElectionStatus() {
    try {
        const res = await fetch(`${API_URL}/check-status`);
        const data = await res.json();

        const badge = document.getElementById('status-badge');
        if (data.open) {
            badge.textContent = 'Abierta';
            badge.className = 'badge open';
        } else {
            badge.textContent = 'Cerrada';
            badge.className = 'badge closed';
            showError('La votación está cerrada', 'El administrador debe abrir la votación desde el panel.');
        }
    } catch (err) {
        showError('Error de conexión', 'No se pudo conectar con el servidor.');
    }
}

async function verifyCode() {
    const code = document.getElementById('access-code').value.trim();
    const errorDiv = document.getElementById('verify-error');
    const btn = document.getElementById('btn-verify');

    if (!code || code.length < 3) {
        errorDiv.textContent = 'Ingresa un código válido';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Verificando...';

    try {
        const res = await fetch(`${API_URL}/verify-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_code: code })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Error al verificar');
        }

        currentStudent = { ...data.student, access_code: code };

        document.getElementById('student-info').innerHTML = `
            <p><strong>Nombre:</strong> ${data.student.name}</p>
            <p><strong>Grado:</strong> ${data.student.grade}°</p>
            <p><strong>Curso:</strong> ${data.student.course}</p>
        `;

        showStep('step-confirm');

    } catch (err) {
        errorDiv.textContent = err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Verificar Código';
    }
}

async function loadCandidates() {
    const container = document.getElementById('candidates-list');
    container.innerHTML = '<p>Cargando candidatos...</p>';

    try {
        const res = await fetch(`${API_URL}/get-candidates`);
        const data = await res.json();

        container.innerHTML = '';

        (data.candidates || []).forEach(candidate => {
            const card = document.createElement('div');
            card.className = 'candidate-card';
            card.innerHTML = `
                <h3>${candidate.name}</h3>
                ${candidate.party ? `<p>${candidate.party}</p>` : ''}
            `;
            card.onclick = () => selectCandidate(candidate, card);
            container.appendChild(card);
        });

        if (!data.candidates || data.candidates.length === 0) {
            container.innerHTML = '<p>No hay candidatos registrados aún</p>';
        }

    } catch (err) {
        container.innerHTML = '<p class="error-message">Error al cargar candidatos</p>';
    }
}

function selectCandidate(candidate, cardElement) {
    document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));

    cardElement.classList.add('selected');
    selectedCandidate = candidate;

    document.getElementById('selected-name').textContent = candidate.name;
    document.getElementById('selected-candidate').classList.remove('hidden');
}

async function castVote() {
    if (!selectedCandidate || !currentStudent) return;

    const btn = document.getElementById('btn-cast');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Procesando...';

    try {
        const res = await fetch(`${API_URL}/cast-vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_code: currentStudent.access_code,
                candidate_id: selectedCandidate.id
            })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Error al registrar voto');
        }

        document.getElementById('final-info').innerHTML = `
            <p><strong>Estudiante:</strong> ${data.student.name}</p>
            <p><strong>Voto registrado para:</strong> ${selectedCandidate.name}</p>
        `;

        showStep('step-done');

    } catch (err) {
        showError('Error al votar', err.message);
    }
}

function showStep(stepId) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(stepId).classList.add('active');

    if (stepId === 'step-vote') {
        loadCandidates();
    }
}

function showError(title, message) {
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = message;
    showStep('step-error');
}
