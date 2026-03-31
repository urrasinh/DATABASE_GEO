document.addEventListener('DOMContentLoaded', initFicha);

async function initFicha() {
    const urlParams = new URLSearchParams(window.location.search);
    const placeId = urlParams.get('id');

    if (!placeId) {
        showError('No se proporcionó un ID de lugar.');
        return;
    }

    try {
        const res = await fetch(`http://localhost:3000/api/lugares/${placeId}`);
        if (!res.ok) throw new Error('Lugar no encontrado en la base de datos');
        
        const data = await res.json();
        renderLugar(data);
        fetchAndLoadMap(data);
    } catch (error) {
        showError(error.message);
    }
}

async function fetchAndLoadMap(placeData) {
    try {
        const configRes = await fetch('http://localhost:3000/api/config/maps');
        const configData = await configRes.json();
        
        if (configData.apiKey && configData.apiKey !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
            loadGoogleMapsScript(configData.apiKey, placeData);
        } else {
            console.warn('API Key de Google Maps no configurada.');
            document.getElementById('map-container').innerHTML = '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: var(--text-muted); text-align:center;">Para ver el mapa interactivo,<br>debes configurar tu API Key en el archivo .env</div>';
            document.getElementById('map-wrap').style.display = 'block';
        }
    } catch (err) {
        console.error('No se pudo verificar la configuración del mapa', err);
    }
}

function loadGoogleMapsScript(apiKey, placeData) {
    window.initMapForPlace = () => initMap(placeData);

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMapForPlace`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

function initMap(data) {
    const geocoder = new google.maps.Geocoder();
    document.getElementById('map-wrap').style.display = 'block';

    const addressParts = [data.direccion, data.localidad, data.comuna, data.provincia, data.region, "Chile"];
    const searchString = addressParts.filter(part => part && String(part).trim() !== '' && String(part).toLowerCase() !== 'null').join(', ');

    geocoder.geocode({ address: searchString }, (results, status) => {
        if (status === 'OK') {
            const mapOptions = {
                zoom: 14,
                center: results[0].geometry.location,
                mapTypeId: 'terrain'
            };
            const map = new google.maps.Map(document.getElementById('map-container'), mapOptions);
            
            new google.maps.Marker({
                map: map,
                position: results[0].geometry.location,
                title: data.nombre
            });
        } else {
            document.getElementById('map-container').innerHTML = '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: var(--text-muted);">El Geocoding no pudo encontrar coordenadas precisas para este lugar.</div>';
        }
    });
}

function renderLugar(data) {
    document.getElementById('loader').style.display = 'none';
    
    const fichaCard = document.getElementById('ficha');
    fichaCard.style.display = 'block';
    
    // Configurar imagen Hero con picsum photos para el wow factor
    const coverBase = document.getElementById('ficha-cover');
    coverBase.style.backgroundImage = `url('https://picsum.photos/seed/${data.id + 500}/1200/600')`;

    // Badges superior
    setText('badge-cat', data.categoria || 'Sin Categoría');
    setText('badge-type', data.tipo || 'Sin Tipo Específico');

    // Header Info
    setText('titulo', data.nombre || 'Nombre no disponible');
    setText('region-loc', `${data.comuna || ''}, ${data.region || ''}`);

    // Body Info
    setText('descripcion', data.descripcion || '<p>No hay descripción detallada disponible para este destino asombroso.</p>', true);
    
    // Grid Stats
    setText('val-jerarquia', data.jerarquia);
    setText('val-propiedad', data.tipo_propiedad);
    setText('val-estacion', data.estacionalidad);
    setText('val-demanda', data.demanda_turistica);
    setText('val-servicios', data.dotacion_servicios);
    setText('val-conservacion', data.conservacion);
    setText('val-direccion', data.direccion);
    setText('val-codigo', data.codigo);
}

function setText(elementId, textData, isHtml = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    let cleanText = cleanFormat(textData);
    if (!cleanText || cleanText === 'Null' || cleanText === 'None') cleanText = 'No especificado';
    
    if (isHtml) {
        el.innerHTML = cleanText;
    } else {
        el.textContent = cleanText;
    }
}

function showError(msg) {
    document.getElementById('loader').style.display = 'none';
    const errPanel = document.getElementById('error-message');
    errPanel.style.display = 'block';
    if(msg) errPanel.querySelector('p').textContent = msg;
}

function cleanFormat(str) {
    if (!str) return '';
    str = String(str).trim();
    if (str.length === 0) return '';
    if (str.length > 50) return str; // Don't title-case long descriptions

    // Capitalize first letter, lowercase rest for short words
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}
