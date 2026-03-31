const API_URL = 'http://localhost:3000/api';
let authToken = localStorage.getItem('adminToken');
let currentPage = 1;
let currentSort = 'id';
let sortDirection = 'ASC';

// Elements
const overlayLogin = document.getElementById('login-overlay');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const tableBody = document.getElementById('table-body');
const modal = document.getElementById('modal');
const modalOverlay = document.getElementById('modal');
const fichaForm = document.getElementById('ficha-form');

// Flow Init
document.addEventListener('DOMContentLoaded', async () => {
    if (authToken) {
        showDashboard();
    }
    await loadAdminMapsScript();
});

// Configure Google Places Autocomplete
let autocompleteInst;
async function loadAdminMapsScript() {
    try {
        const configRes = await fetch(`${API_URL}/config/maps`);
        const configData = await configRes.json();
        
        if (configData.apiKey && configData.apiKey !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
            window.initAutocomplete = () => {
                const input = document.getElementById('f-direccion');
                autocompleteInst = new google.maps.places.Autocomplete(input, {
                    componentRestrictions: { country: "cl" },
                    fields: ["address_components", "geometry", "icon", "name"],
                });
            };

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${configData.apiKey}&libraries=places&callback=initAutocomplete`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }
    } catch (err) {
        console.warn('Maps Config Error', err);
    }
}

// Login Handlder
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        if (res.ok) {
            authToken = data.token;
            localStorage.setItem('adminToken', authToken);
            showDashboard();
        } else {
            loginError.textContent = data.error || 'Autenticación fallida';
        }
    } catch (err) {
        loginError.textContent = 'Error de conexión con el servidor.';
    }
});

// Logout
document.getElementById('btn-logout').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('adminToken');
    authToken = null;
    dashboard.style.display = 'none';
    overlayLogin.style.display = 'flex';
});

async function showDashboard() {
    overlayLogin.style.display = 'none';
    dashboard.style.display = 'grid';
    await fetchFilterDatalists();
    loadTableData();
}

// DataList population for easy typing "tickets de seleccion"
async function fetchFilterDatalists() {
    try {
        const res = await fetch(`${API_URL}/filtros`);
        const data = await res.json();
        
        // Define all categories that need a datalist
        const categories = [
            'region', 'provincia', 'comuna', 'localidad', 'jerarquia', 
            'categoria', 'tipo', 'subtipo', 'tipo_propiedad', 'demanda_turistica'
        ];

        categories.forEach(cat => {
            const dl = document.getElementById(`dl-${cat}`);
            if (dl && data[cat]) {
                dl.innerHTML = ''; // clear previous
                data[cat].forEach(val => {
                    const opt = document.createElement('option');
                    opt.value = String(val).replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
                    dl.appendChild(opt);
                });
            }
            
            // Populate Dropdown Filters in Dashboard
            const sel = document.getElementById(`filter-${cat}`);
            if (sel && data[cat]) {
                const label = cat === 'region' ? 'Regiones' : (cat === 'categoria' ? 'Categorías' : 'Jerarquías');
                sel.innerHTML = `<option value="">Todas las ${label}</option>`;
                data[cat].forEach(val => {
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.textContent = String(val).replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
                    sel.appendChild(opt);
                });
            }
        });
    } catch (err) {
        console.error('Error fetching datalists', err);
    }
}

// Load main table
async function loadTableData() {
    try {
        const search = document.getElementById('search-input').value;
        const region = document.getElementById('filter-region')?.value;
        const categoria = document.getElementById('filter-categoria')?.value;
        const jerarquia = document.getElementById('filter-jerarquia')?.value;
        
        const params = new URLSearchParams({
            pagina: currentPage,
            limite: 200,
            sort: currentSort,
            order: sortDirection
        });
        
        if (search) params.append('search', search);
        if (region) params.append('region', region);
        if (categoria) params.append('categoria', categoria);
        if (jerarquia) params.append('jerarquia', jerarquia);

        const res = await fetch(`${API_URL}/lugares?${params.toString()}`);
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        
        tableBody.innerHTML = '';
        
        document.querySelectorAll('.page-indicator').forEach(el => {
            el.textContent = `Pág. ${data.pagination.currentPage} de ${data.pagination.totalPages}`;
        });
        
        const countSpan = document.getElementById('total-fichas-count');
        if (countSpan) {
            countSpan.innerHTML = `Mostrando <strong>${data.data.length}</strong> de <strong>${data.pagination.total}</strong>`;
        }
        
        data.data.forEach(lugar => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${lugar.codigo || '-'}</td>
                <td><strong>${lugar.nombre || 'Sin Nombre'}</strong></td>
                <td>${lugar.region || '-'}</td>
                <td><span class="badge category">${lugar.categoria || 'N/A'}</span></td>
                <td>${lugar.jerarquia || '-'}</td>
                <td class="actions">
                    <button class="btn-icon" onclick="openEdit(${lugar.id})" title="Editar"><i class='bx bx-edit'></i></button>
                    <button class="btn-icon delete" onclick="deleteLugar(${lugar.id})" title="Eliminar"><i class='bx bx-trash'></i></button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (err) {
        if(err.message.includes('401') || err.message.includes('403')) {
            // Token expired
            document.getElementById('btn-logout').click();
        }
        console.error('Error carga tabla', err);
    }
}

// Pagination
document.querySelectorAll('.btn-prev-page').forEach(btn => {
    btn.addEventListener('click', () => { if(currentPage>1) { currentPage--; loadTableData(); }});
});
document.querySelectorAll('.btn-next-page').forEach(btn => {
    btn.addEventListener('click', () => { currentPage++; loadTableData(); });
});

// Sorting Listner
document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const sortField = th.getAttribute('data-sort');
        if (currentSort === sortField) {
            sortDirection = sortDirection === 'ASC' ? 'DESC' : 'ASC';
        } else {
            currentSort = sortField;
            sortDirection = 'ASC';
        }
        
        // Update visual icons
        document.querySelectorAll('th.sortable i').forEach(i => i.className = 'bx bx-sort');
        const icon = th.querySelector('i');
        if(icon) {
            icon.className = sortDirection === 'ASC' ? 'bx bx-sort-up' : 'bx bx-sort-down';
        }

        currentPage = 1;
        loadTableData();
    });
});

// Filter & Search Events
document.getElementById('search-input').addEventListener('input', () => { currentPage = 1; loadTableData(); });
document.getElementById('filter-region').addEventListener('change', () => { currentPage = 1; loadTableData(); });
document.getElementById('filter-categoria').addEventListener('change', () => { currentPage = 1; loadTableData(); });
document.getElementById('filter-jerarquia').addEventListener('change', () => { currentPage = 1; loadTableData(); });


// Modals logic
document.getElementById('btn-create').addEventListener('click', () => {
    fichaForm.reset();
    document.getElementById('f-id').value = '';
    document.getElementById('modal-title').textContent = 'Nueva Ficha de Lugar';
    document.getElementById('form-msg').textContent = '';
    modalOverlay.classList.add('active');
});

document.getElementById('btn-close-modal').addEventListener('click', () => modalOverlay.classList.remove('active'));
document.getElementById('btn-cancelar').addEventListener('click', () => modalOverlay.classList.remove('active'));

window.openEdit = async (id) => {
    try {
        const res = await fetch(`${API_URL}/lugares/${id}`);
        const lugar = await res.json();
        
        document.getElementById('modal-title').textContent = `Editando: ${lugar.nombre}`;
        
        // Populate inputs
        document.getElementById('f-id').value = lugar.id;
        document.getElementById('f-codigo').value = lugar.codigo || '';
        document.getElementById('f-nombre').value = lugar.nombre || '';
        document.getElementById('f-region').value = lugar.region || '';
        document.getElementById('f-provincia').value = lugar.provincia || '';
        document.getElementById('f-comuna').value = lugar.comuna || '';
        document.getElementById('f-localidad').value = lugar.localidad || '';
        document.getElementById('f-direccion').value = lugar.direccion || '';
        document.getElementById('f-jerarquia').value = lugar.jerarquia || '';
        document.getElementById('f-categoria').value = lugar.categoria || '';
        document.getElementById('f-tipo').value = lugar.tipo || '';
        document.getElementById('f-subtipo').value = lugar.subtipo || '';
        document.getElementById('f-tipo_propiedad').value = lugar.tipo_propiedad || '';
        document.getElementById('f-demanda_turistica').value = lugar.demanda_turistica || '';
        document.getElementById('f-estacionalidad').value = lugar.estacionalidad || '';
        document.getElementById('f-dotacion_servicios').value = lugar.dotacion_servicios || '';
        document.getElementById('f-conservacion').value = lugar.conservacion || '';
        document.getElementById('f-descripcion').value = lugar.descripcion || '';

        document.getElementById('form-msg').textContent = '';
        modalOverlay.classList.add('active');
    } catch (err) {
        alert('No se pudo cargar la ficha');
    }
};

window.deleteLugar = async (id) => {
    if (confirm('¿Estás seguro de que deseas eliminar este lugar permanentemente?')) {
        try {
            const res = await fetch(`${API_URL}/lugares/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if(res.ok) {
                loadTableData();
            } else {
                alert('No se pudo eliminar');
            }
        } catch (err) {
            console.error(err);
        }
    }
};

// Form Submit (Create / Edit)
fichaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const msgEl = document.getElementById('form-msg');
    
    // Collect data
    const payload = {
        codigo: document.getElementById('f-codigo').value,
        nombre: document.getElementById('f-nombre').value,
        region: document.getElementById('f-region').value,
        provincia: document.getElementById('f-provincia').value,
        comuna: document.getElementById('f-comuna').value,
        localidad: document.getElementById('f-localidad').value,
        direccion: document.getElementById('f-direccion').value,
        jerarquia: document.getElementById('f-jerarquia').value,
        categoria: document.getElementById('f-categoria').value,
        tipo: document.getElementById('f-tipo').value,
        subtipo: document.getElementById('f-subtipo').value,
        tipo_propiedad: document.getElementById('f-tipo_propiedad').value,
        demanda_turistica: document.getElementById('f-demanda_turistica').value,
        estacionalidad: document.getElementById('f-estacionalidad').value,
        dotacion_servicios: document.getElementById('f-dotacion_servicios').value,
        conservacion: document.getElementById('f-conservacion').value,
        descripcion: document.getElementById('f-descripcion').value
    };

    try {
        msgEl.style.color = 'var(--text-muted)';
        msgEl.textContent = 'Guardando...';

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/lugares/${id}` : `${API_URL}/lugares`;

        const res = await fetch(url, {
            method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            msgEl.style.color = 'green';
            msgEl.textContent = 'Ficha guardada exitosamente.';
            setTimeout(() => {
                modalOverlay.classList.remove('active');
                loadTableData();
                fetchFilterDatalists(); // refresh datalists in case new tags were added
            }, 1000);
        } else {
            msgEl.style.color = 'red';
            msgEl.textContent = 'Error al intentar guardar. Revisa sesión.';
        }
    } catch (err) {
        msgEl.style.color = 'red';
        msgEl.textContent = err.message;
    }
});
