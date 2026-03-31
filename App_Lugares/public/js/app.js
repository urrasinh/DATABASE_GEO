const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api' 
    : 'https://TU-PROYECTO.onrender.com/api';

// Estado de la aplicación
const state = {
    filters: {
        zona: '',
        region: '',
        tipo: '',
        subtipo: '',
        categoria: '',
        tipo_propiedad: '',
        demanda_turistica: ''
    },
    pagination: {
        page: 1,
        limit: 21, // 3 cols * 7 rows
        totalPages: 1,
        totalItems: 0
    }
};

// Selectores
const selectors = {
    zona: document.getElementById('zona'),
    region: document.getElementById('region'),
    tipo: document.getElementById('tipo'),
    subtipo: document.getElementById('subtipo'),
    categoria: document.getElementById('categoria'),
    tipo_propiedad: document.getElementById('tipo_propiedad'),
    demanda_turistica: document.getElementById('demanda_turistica')
};

const grid = document.getElementById('lugares-grid');
const totalResults = document.getElementById('total-results');
const pInfo = document.getElementById('page-info');
const btnPrev = document.getElementById('prev-page');
const btnNext = document.getElementById('next-page');

// Inicialización
async function init() {
    setupEventListeners();
    await fetchFiltros();
    await fetchLugares();
}

function setupEventListeners() {
    // Escuchar cambios en los selectores
    Object.keys(selectors).forEach(key => {
        if (!selectors[key]) return;
        selectors[key].addEventListener('change', (e) => {
            state.filters[key] = e.target.value;
            state.pagination.page = 1; // reset page on filter
            fetchLugares();
        });
    });

    document.getElementById('reset-filters').addEventListener('click', () => {
        Object.keys(selectors).forEach(key => {
            if (selectors[key]) selectors[key].value = '';
            state.filters[key] = '';
        });
        state.pagination.page = 1;
        fetchLugares();
    });

    btnPrev.addEventListener('click', () => {
        if (state.pagination.page > 1) {
            state.pagination.page--;
            window.scrollTo({ top: 400, behavior: 'smooth' });
            fetchLugares();
        }
    });

    btnNext.addEventListener('click', () => {
        if (state.pagination.page < state.pagination.totalPages) {
            state.pagination.page++;
            window.scrollTo({ top: 400, behavior: 'smooth' });
            fetchLugares();
        }
    });

    // Hero Zones
    document.querySelectorAll('.btn-zone').forEach(btn => {
        btn.addEventListener('click', () => {
            const zona = btn.getAttribute('data-zona');
            document.querySelectorAll('.btn-zone').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (selectors.zona) {
                selectors.zona.value = zona;
                // Update state and fetch directly mapped to the event
                state.filters.zona = zona;
                state.pagination.page = 1;
                fetchLugares();
                document.getElementById('sidebar').scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Autocomplete
    const heroSearch = document.getElementById('hero-search-input');
    const suggestionsBox = document.getElementById('search-suggestions');
    const suggestionsList = document.getElementById('suggestions-list');

    if (heroSearch) {
        heroSearch.addEventListener('input', debounce(async (e) => {
            const q = e.target.value;
            if (q.trim().length < 2) {
                suggestionsBox.style.display = 'none';
                return;
            }

            try {
                const res = await fetch(`${API_URL}/autocomplete?q=${encodeURIComponent(q)}`);
                const data = await res.json();

                if (data.length > 0) {
                    suggestionsList.innerHTML = data.map(item => `
                        <li onclick="window.location.href='lugar.html?id=${item.id}'">
                            <strong>${cleanFormat(item.nombre)}</strong>
                            <small>${item.codigo || ''} - ${cleanFormat(item.region || '')}</small>
                        </li>
                    `).join('');
                    suggestionsBox.style.display = 'block';
                } else {
                    suggestionsList.innerHTML = `<li style="text-align:center; color:var(--text-muted); padding:1rem; cursor:default;">No se encontraron resultados</li>`;
                    suggestionsBox.style.display = 'block';
                }
            } catch (err) {
                console.error('Autocomplete error', err);
            }
        }, 300));

        // Clic fuera cierra sugerencias
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.hero-search-wrapper') && suggestionsBox) {
                suggestionsBox.style.display = 'none';
            }
        });
    }

    // Lógica Móvil (Sidebar de Filtros y Menú)
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    const mobileFilterBtn = document.getElementById('mobile-filter-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');

    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    function toggleFilters(show) {
        if (!sidebar || !sidebarOverlay) return;
        if (show) {
            sidebar.classList.add('active');
            sidebarOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // prevent bg scroll
        } else {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    if (mobileFilterBtn) {
        mobileFilterBtn.addEventListener('click', () => toggleFilters(true));
    }
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => toggleFilters(false));
    }
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => toggleFilters(false));
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            toggleFilters(false);
            if (navLinks) navLinks.classList.remove('active'); // Also close menu on overlay click
        });
    }
}

// Utilidad Debounce
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Obtener Opciones de Filtros
async function fetchFiltros() {
    try {
        const res = await fetch(`${API_URL}/filtros`);
        const data = await res.json();

        populateSelect(selectors.zona, data.zonas);
        populateSelect(selectors.region, data.region);
        populateSelect(selectors.tipo, data.tipo);
        populateSelect(selectors.subtipo, data.subtipo);
        populateSelect(selectors.categoria, data.categoria);
        populateSelect(selectors.tipo_propiedad, data.tipo_propiedad);
        populateSelect(selectors.demanda_turistica, data.demanda_turistica);
    } catch (err) {
        console.error('Error fetching filters:', err);
    }
}

function populateSelect(selectEl, optionsArray) {
    if (!selectEl || !optionsArray) return;
    optionsArray.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = cleanFormat(opt);
        selectEl.appendChild(option);
    });
}

// Obtener lugares filtrados
async function fetchLugares() {
    try {
        grid.innerHTML = `<div class="loading-spinner"><i class='bx bx-loader-alt bx-spin'></i> Buscando aventuras...</div>`;

        // Construir query string
        const params = new URLSearchParams();
        Object.keys(state.filters).forEach(key => {
            if (state.filters[key]) params.append(key, state.filters[key]);
        });
        params.append('pagina', state.pagination.page);
        params.append('limite', state.pagination.limit);

        const res = await fetch(`${API_URL}/lugares?${params.toString()}`);
        const result = await res.json();

        state.pagination.totalItems = result.pagination.total;
        state.pagination.totalPages = result.pagination.totalPages;

        renderGrid(result.data);
        updatePaginationUI();
    } catch (err) {
        grid.innerHTML = `<div class="error-glass">Error al cargar lugares: ${err.message}</div>`;
        console.error('Error fetching lugares:', err);
    }
}

function renderGrid(lugares) {
    grid.innerHTML = '';

    if (lugares.length === 0) {
        grid.innerHTML = `
            <div class="error-glass" style="grid-column: 1/-1;">
                <i class='bx bx-search-alt'></i>
                <h2>No hay coincidencias</h2>
                <p>Prueba ajustando los filtros para ver más resultados.</p>
            </div>`;
        return;
    }

    lugares.forEach(lugar => {
        // Unsplash Random nature/chile/type image
        const queryTerm = encodeURIComponent(lugar.categoria || 'nature');
        const imgUrl = `https://source.unsplash.com/random/400x300/?chile,${queryTerm},landscape&sig=${lugar.id}`; // using sig avoids same cache

        const card = document.createElement('a');
        card.href = `lugar.html?id=${lugar.id}`;
        card.className = 'card-glass';
        card.innerHTML = `
            <div class="card-img-container">
                <div class="card-badges">
                    ${lugar.categoria ? `<span class="badge category">${cleanFormat(lugar.categoria)}</span>` : ''}
                    ${lugar.region ? `<span class="badge region">${cleanFormat(lugar.region).split(' ')[0]}</span>` : ''}
                </div>
                <!-- Removed direct unsplash due to deprecation warnings, using deterministic placeholder -->
                <img src="https://picsum.photos/seed/${lugar.id + 100}/400/300" alt="${lugar.nombre}" class="card-img" loading="lazy">
            </div>
            <div class="card-content">
                <h3 class="card-title">${cleanFormat(lugar.nombre) || 'Lugar Desconocido'}</h3>
                <div class="card-meta">
                    <i class='bx bx-map'></i> ${cleanFormat(lugar.comuna || lugar.region || '')}
                </div>
                <p class="card-desc">${cleanFormat(lugar.descripcion) || 'Sin descripción disponible para este lugar fascinante de Chile. Explora más ingresando al detalle.'}</p>
                <div class="card-footer">
                    <span><i class='bx bx-navigation'></i> Ver Ficha Completa</span>
                    <i class='bx bx-right-arrow-alt' style="font-size: 1.5rem;"></i>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function updatePaginationUI() {
    totalResults.textContent = state.pagination.totalItems;
    pInfo.textContent = `Página ${state.pagination.page} de ${state.pagination.totalPages || 1}`;

    btnPrev.disabled = state.pagination.page <= 1;
    btnNext.disabled = state.pagination.page >= state.pagination.totalPages;
}

// Utilidad para limpiar textos mayúsculos del CSV
function cleanFormat(str) {
    if (!str) return '';
    str = String(str).trim();
    if (str.length === 0) return '';
    // Capitalize first letter, lowercase rest
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

// Iniciar app
document.addEventListener('DOMContentLoaded', init);
