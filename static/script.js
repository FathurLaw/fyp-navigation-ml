mapboxgl.accessToken = 'pk.eyJ1IjoibWhkZmF0aHVyIiwiYSI6ImNtMmhkYTA1bTA4NHkyanNhZnFkNzM2Z2EifQ.B-mxNfjMH28RiQH3CYYWEQ';

function updateWeatherAndTime() {
    const weatherApiKey = 'b119e21f2839bdc54e7282b5959d2aa3';
    const lat = 3.006; 
    const lon = 101.721;

    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${weatherApiKey}&units=metric`)
        .then(res => res.json())
        .then(data => {
            const temp = data.main.temp.toFixed(1);
            const desc = data.weather[0].description;
            const icon = data.weather[0].icon;

            $('#weather-info').html(`
                <img src="https://openweathermap.org/img/wn/${icon}@2x.png" class="inline w-6 h-6" alt="${desc}">
                <span class="ml-1">${temp}°C, ${desc}</span>
            `);
        }).catch(err => {
            console.error("Failed to load weather data:", err);
        });

    const now = new Date();
    $('#time-info').text(now.toLocaleTimeString());
}

updateWeatherAndTime();
setInterval(updateWeatherAndTime, 1000);

let buildingData = [];

    fetch('/static/building_locations.json')
    .then(response => response.json())
    .then(data => {
        buildingData = data;

        const startSelect = $('#start_building').empty();
        const endSelect = $('#end_building').empty();

        data.forEach(building => {
        startSelect.append(`<option value="${building.name}">${building.name}</option>`);
        endSelect.append(`<option value="${building.name}">${building.name}</option>`);
        });

        $('#start_lab').prop('disabled', true).empty();
        $('#end_lab').prop('disabled', true).empty();

        initializeMap();
    });

    $('#start_building').on('change', function () {
    const selectedBlock = $(this).val();
    const labsSelect = $('#start_lab');
    labsSelect.empty();

    const block = buildingData.find(b => b.name === selectedBlock);

    if (block && block.sublocations && block.sublocations.length > 0) {
        labsSelect.prop('disabled', false);
        block.sublocations.forEach(lab => {
        labsSelect.append(`<option value="${lab.code}">${lab.code}: ${lab.name}</option>`);
        });
    } else {
        labsSelect.prop('disabled', true);
    }
    });

    $('#end_building').on('change', function () {
    const selectedBlock = $(this).val();
    const labsSelect = $('#end_lab');
    labsSelect.empty();

    const block = buildingData.find(b => b.name === selectedBlock);

    if (block && block.sublocations && block.sublocations.length > 0) {
        labsSelect.prop('disabled', false);
        block.sublocations.forEach(lab => {
        labsSelect.append(`<option value="${lab.code}">${lab.code}: ${lab.name}</option>`);
        });
    } else {
        labsSelect.prop('disabled', true);
    }
    });

    let map;
    function initializeMap(center = [101.720476, 3.005243]) {
        const isMobile = window.innerWidth <= 768; 
        const zoom = isMobile ? 15.75 : 17;
    
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/outdoors-v12',
            center: center,
            zoom: zoom,
            pitch: 60,
            bearing: -20,
            antialias: true,
            maxBounds: [
                [101.71718, 3.00225],
                [101.72494, 3.01067]
            ],
            minZoom: 15,
            maxZoom: 19
        });
    
        map.on('load', () => {
            map.addSource('mapbox-dem', {
                type: 'raster-dem',
                url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                tileSize: 512,
                maxzoom: 14
            });
            map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    
            map.addLayer({
                id: 'sky',
                type: 'sky',
                paint: {
                    'sky-type': 'atmosphere',
                    'sky-atmosphere-sun': [0.0, 0.0],
                    'sky-atmosphere-sun-intensity': 15
                }
            });
    
            map.addLayer({
                id: '3d-buildings',
                source: 'composite',
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: 15,
                paint: {
                    'fill-extrusion-color': '#aaa',
                    'fill-extrusion-height': ['get', 'height'],
                    'fill-extrusion-base': ['get', 'min_height'],
                    'fill-extrusion-opacity': 0.7
                }
            });
        });
    }    

$('#start-navigation').click(function (event) {
    event.preventDefault();

    const startBlockName = $('#start_building').val();
    const startLabCode = $('#start_lab').val();
    const endBlockName = $('#end_building').val();
    const endLabCode = $('#end_lab').val();

    const startBlock = buildingData.find(b => b.name === startBlockName);
    let start = startBlock;
    if (startLabCode && startBlock && startBlock.sublocations) {
        const lab = startBlock.sublocations.find(l => l.code === startLabCode);
        if (lab) {
            start = {
                lat: startBlock.lat,
                lon: startBlock.lon,
                name: `${startLabCode}: ${lab.name}`
            };
        }
    }

    const endBlock = buildingData.find(b => b.name === endBlockName);
    let end = endBlock;
    if (endLabCode && endBlock && endBlock.sublocations) {
        const lab = endBlock.sublocations.find(l => l.code === endLabCode);
        if (lab) {
            end = {
                lat: endBlock.lat,
                lon: endBlock.lon,
                name: `${endLabCode}: ${lab.name}`
            };
        }
    }

    if (!start || !end) {
        $('#error-message').text("Invalid building or lab selection.").removeClass('hidden');
        return;
    } else {
        $('#error-message').addClass('hidden');

        // ====== NEW: Center map at midpoint between start and end ======
        const isMobile = window.innerWidth <= 768;
        const zoomLevel = isMobile ? 16.5 : 18;

        const midLat = (start.lat + end.lat) / 2;
        const midLon = (start.lon + end.lon) / 2;

        map.flyTo({
            center: [midLon, midLat],
            zoom: zoomLevel,
            essential: true
        });
        // ==============================================================

        $.post('/predict', {
            start_lat: start.lat,
            start_lon: start.lon,
            end_lat: end.lat,
            end_lon: end.lon
        }, function (data) {
            $('#eta').text(data.eta);
            $('#distance').text(data.distance);
            $('#result').removeClass('hidden');

            $.get('/path', {
                start_lat: start.lat,
                start_lon: start.lon,
                end_lat: end.lat,
                end_lon: end.lon
            }, function (pathData) {
                if (pathData.error || !Array.isArray(pathData.path)) {
                    $('#error-message').text("Path not found.").removeClass('hidden');
                    return;
                }

                if (map.getLayer('route')) map.removeLayer('route');
                if (map.getSource('route')) map.removeSource('route');

                if (window.startMarker) window.startMarker.remove();
                if (window.endMarker) window.endMarker.remove();

                const startLabel = `
                <div class="px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-400 text-black-300 text-black text-sm font-semibold shadow-lg backdrop-blur-md">
                    🟢 ${start.name}
                </div>`;

                const endLabel = `
                <div class="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-400 text-black-300 text-black text-sm font-semibold shadow-lg backdrop-blur-md">
                    🔴 ${end.name}
                </div>`;


                window.startMarker = new mapboxgl.Marker({ color: 'red' })
                    .setLngLat([start.lon, start.lat])
                    .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false, closeOnClick: false }).setHTML(startLabel))
                    .addTo(map)
                    .togglePopup();

                window.endMarker = new mapboxgl.Marker({ color: 'green' })
                    .setLngLat([end.lon, end.lat])
                    .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false, closeOnClick: false }).setHTML(endLabel))
                    .addTo(map)
                    .togglePopup();

                const pathCoordinates = pathData.path.map(coord => [coord[1], coord[0]]);

                const route = {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: pathCoordinates
                        }
                    }]
                };

                map.addSource('route', {
                    type: 'geojson',
                    data: route
                });

                map.addLayer({
                    id: 'route',
                    type: 'line',
                    source: 'route',
                    paint: {
                        'line-color': '#0056f7',
                        'line-width': 4
                    }
                });

                if (navigator.geolocation) {
                    navigator.geolocation.watchPosition(function (position) {
                        const userLng = position.coords.longitude;
                        const userLat = position.coords.latitude;

                        if (window.userMarker) {
                            window.userMarker.setLngLat([userLng, userLat]);
                        } else {
                            window.userMarker = new mapboxgl.Marker({ color: 'blue' })
                                .setLngLat([userLng, userLat])
                                .addTo(map);
                        }
                    }, function (error) {
                        console.error("Error getting location: ", error);
                    }, {
                        enableHighAccuracy: true
                    });
                } else {
                    alert("Geolocation is not supported by your browser.");
                }
            });
        });
    }
});

const toggleBtn = document.getElementById('toggleDrawer');
const drawer = document.getElementById('mobile-drawer');
const drawerContent = document.getElementById('drawer-content');
const drawerIcon = document.getElementById('drawer-icon');

let isDrawerOpen = true;

function toggleDrawer(state) {
  isDrawerOpen = typeof state === 'boolean' ? state : !isDrawerOpen;
  drawerContent.style.display = isDrawerOpen ? 'block' : 'none';
  drawerIcon.textContent = isDrawerOpen ? '▼' : '▲';
}

toggleBtn.addEventListener('click', () => toggleDrawer());

let startY = 0;
drawer.addEventListener('touchstart', (e) => {
  startY = e.touches[0].clientY;
});

drawer.addEventListener('touchend', (e) => {
  const endY = e.changedTouches[0].clientY;
  const deltaY = endY - startY;

  if (Math.abs(deltaY) > 30) {
    if (deltaY > 0) {
      toggleDrawer(false);
    } else {
      toggleDrawer(true);
    }
  }
});
