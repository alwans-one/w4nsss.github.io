// ===================================
// WEATHER DASHBOARD - MAIN JAVASCRIPT
// ===================================

// API Configuration
// NOTE: Replace 'YOUR_API_KEY_HERE' with your actual OpenWeatherMap API key
// Get your free API key at: https://openweathermap.org/api
const API_KEY = 'dcec69d2b089f8c30029c65b856bd14c';
const API_BASE = 'https://api.openweathermap.org/data/2.5';
const GEO_API = 'https://api.openweathermap.org/geo/1.0';

// State Management
let currentUnit = 'metric'; // 'metric' or 'imperial'
let currentTheme = 'light'; // 'light' or 'dark'
let currentLocationData = null;
let recentSearches = [];
let favorites = [];
let searchTimeout = null;

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    console.log('Initializing Weather Dashboard...');
    
    // Load saved data
    loadPreferences();
    loadFavorites();
    loadRecentSearches();
    
    // Setup event listeners
    setupEventListeners();
    
    // Get user's location on load
    getUserLocation();
}

// ===================================
// PREFERENCES MANAGEMENT
// ===================================

function loadPreferences() {
    // Load temperature unit preference
    const savedUnit = localStorage.getItem('weatherUnit');
    if (savedUnit) {
        currentUnit = savedUnit;
        updateUnitButton();
    }
    
    // Load theme preference
    const savedTheme = localStorage.getItem('weatherTheme');
    if (savedTheme) {
        currentTheme = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeButton();
    }
}

function savePreferences() {
    localStorage.setItem('weatherUnit', currentUnit);
    localStorage.setItem('weatherTheme', currentTheme);
}

// ===================================
// EVENT LISTENERS SETUP
// ===================================

function setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Unit toggle
    document.getElementById('unitToggle').addEventListener('click', toggleUnit);
    
    // Location button
    document.getElementById('locationBtn').addEventListener('click', getUserLocation);
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keydown', handleSearchKeydown);
    searchInput.addEventListener('blur', () => {
        // Delay hiding suggestions to allow click events
        setTimeout(() => {
            document.getElementById('suggestions').classList.remove('active');
        }, 200);
    });
    
    // Add to favorites
    document.getElementById('addFavorite').addEventListener('click', addToFavorites);
    
    console.log('Event listeners setup complete');
}

// ===================================
// THEME MANAGEMENT
// ===================================

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('weatherTheme', currentTheme);
    updateThemeButton();
    
    console.log('Theme toggled to:', currentTheme);
}

function updateThemeButton() {
    const btn = document.getElementById('themeToggle');
    btn.textContent = currentTheme === 'light' ? '🌙 Dark' : '☀️ Light';
    btn.setAttribute('aria-label', `Switch to ${currentTheme === 'light' ? 'dark' : 'light'} mode`);
}

// ===================================
// UNIT MANAGEMENT
// ===================================

function toggleUnit() {
    currentUnit = currentUnit === 'metric' ? 'imperial' : 'metric';
    localStorage.setItem('weatherUnit', currentUnit);
    updateUnitButton();
    
    // Refresh display if weather data exists
    if (currentLocationData) {
        displayWeatherData(currentLocationData);
    }
    
    console.log('Unit toggled to:', currentUnit);
}

function updateUnitButton() {
    const btn = document.getElementById('unitToggle');
    btn.textContent = currentUnit === 'metric' ? '°F' : '°C';
    btn.setAttribute('aria-label', `Switch to ${currentUnit === 'metric' ? 'Fahrenheit' : 'Celsius'}`);
}

// ===================================
// GEOLOCATION
// ===================================

function getUserLocation() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        // Fallback to default location
        fetchWeatherByCity('Jakarta');
        return;
    }

    showLoading(true);
    console.log('Getting user location...');
    
    navigator.geolocation.getCurrentPosition(
        position => {
            const { latitude, longitude } = position.coords;
            console.log('Location obtained:', latitude, longitude);
            fetchWeatherByCoords(latitude, longitude);
        },
        error => {
            console.error('Geolocation error:', error);
            showError('Unable to get your location. Showing default location.');
            // Fallback to default location
            fetchWeatherByCity('Jakarta');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// ===================================
// SEARCH FUNCTIONALITY
// ===================================

function handleSearchInput(e) {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    // Hide suggestions if query is too short
    if (query.length < 2) {
        document.getElementById('suggestions').classList.remove('active');
        return;
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
        fetchCitySuggestions(query);
    }, 300);
}

function handleSearchKeydown(e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
            document.getElementById('suggestions').classList.remove('active');
            fetchWeatherByCity(query);
        }
    } else if (e.key === 'Escape') {
        document.getElementById('suggestions').classList.remove('active');
    }
}

async function fetchCitySuggestions(query) {
    try {
        const response = await fetch(
            `${GEO_API}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch suggestions');
        }
        
        const data = await response.json();
        displaySuggestions(data);
    } catch (error) {
        console.error('Error fetching suggestions:', error);
    }
}

function displaySuggestions(cities) {
    const container = document.getElementById('suggestions');
    
    if (cities.length === 0) {
        container.classList.remove('active');
        return;
    }

    container.innerHTML = cities.map(city => {
        const locationName = `${city.name}${city.state ? ', ' + city.state : ''}, ${city.country}`;
        return `
            <div class="suggestion-item" 
                 onclick="selectCity('${city.name}', '${city.country}', ${city.lat}, ${city.lon})" 
                 role="option" 
                 tabindex="0">
                📍 ${locationName}
            </div>
        `;
    }).join('');
    
    container.classList.add('active');
}

function selectCity(city, country, lat, lon) {
    document.getElementById('searchInput').value = `${city}, ${country}`;
    document.getElementById('suggestions').classList.remove('active');
    fetchWeatherByCoords(lat, lon);
}

// ===================================
// API CALLS
// ===================================

async function fetchWeatherByCoords(lat, lon) {
    showLoading(true);
    
    try {
        const [currentResponse, forecastResponse] = await Promise.all([
            fetch(`${API_BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnit}`),
            fetch(`${API_BASE}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnit}`)
        ]);

        if (!currentResponse.ok || !forecastResponse.ok) {
            throw new Error('Failed to fetch weather data');
        }

        const currentData = await currentResponse.json();
        const forecastData = await forecastResponse.json();

        currentLocationData = { 
            current: currentData, 
            forecast: forecastData 
        };
        
        displayWeatherData(currentLocationData);
        addToRecentSearches(currentData.name);
        showLoading(false);
        
        console.log('Weather data fetched successfully');
    } catch (error) {
        console.error('Error fetching weather:', error);
        showError('Failed to fetch weather data. Please check your API key or try again.');
        showLoading(false);
    }
}

async function fetchWeatherByCity(city) {
    showLoading(true);
    
    try {
        // First get coordinates for the city
        const geoResponse = await fetch(
            `${GEO_API}/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`
        );
        
        if (!geoResponse.ok) {
            throw new Error('City not found');
        }
        
        const geoData = await geoResponse.json();
        
        if (geoData.length === 0) {
            throw new Error('City not found');
        }
        
        const { lat, lon } = geoData[0];
        await fetchWeatherByCoords(lat, lon);
        
    } catch (error) {
        console.error('Error fetching weather by city:', error);
        showError('City not found or failed to fetch data');
        showLoading(false);
    }
}

// ===================================
// DISPLAY FUNCTIONS
// ===================================

function displayWeatherData(data) {
    const { current, forecast } = data;
    
    // Get unit symbols
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';
    const windUnit = currentUnit === 'metric' ? 'km/h' : 'mph';
    const windSpeed = currentUnit === 'metric' 
        ? (current.wind.speed * 3.6).toFixed(1) 
        : current.wind.speed.toFixed(1);
    
    // Display current weather
    document.getElementById('temperature').textContent = 
        `${Math.round(current.main.temp)}${tempUnit}`;
    
    document.getElementById('condition').textContent = 
        current.weather[0].description.charAt(0).toUpperCase() + 
        current.weather[0].description.slice(1);
    
    document.getElementById('location').textContent = 
        `${current.name}, ${current.sys.country}`;
    
    document.getElementById('weatherIcon').textContent = 
        getWeatherIcon(current.weather[0].main);
    
    document.getElementById('feelsLike').textContent = 
        `${Math.round(current.main.feels_like)}${tempUnit}`;
    
    document.getElementById('humidity').textContent = 
        `${current.main.humidity}%`;
    
    document.getElementById('windSpeed').textContent = 
        `${windSpeed} ${windUnit}`;
    
    document.getElementById('pressure').textContent = 
        `${current.main.pressure} hPa`;
    
    // Visibility
    const visibility = (current.visibility / 1000).toFixed(1);
    document.getElementById('visibility').textContent = `${visibility} km`;
    
    // UV Index (placeholder - requires additional API call)
    document.getElementById('uvIndex').textContent = 'N/A';
    
    // Sunrise and Sunset
    const sunrise = new Date(current.sys.sunrise * 1000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    const sunset = new Date(current.sys.sunset * 1000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    document.getElementById('sunrise').textContent = sunrise;
    document.getElementById('sunset').textContent = sunset;

    // Display forecasts
    displayHourlyForecast(forecast.list.slice(0, 8));
    displayDailyForecast(forecast.list);

    // Show sections
    document.getElementById('currentWeather').style.display = 'block';
    document.getElementById('hourlyForecast').style.display = 'block';
    document.getElementById('forecastSection').style.display = 'block';
}

function displayHourlyForecast(hourlyData) {
    const container = document.getElementById('hourlyGrid');
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';
    
    container.innerHTML = hourlyData.map(hour => {
        const date = new Date(hour.dt * 1000);
        const time = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        return `
            <div class="hourly-item">
                <div style="font-weight: 600; margin-bottom: 5px;">${time}</div>
                <div style="font-size: 2rem; margin: 10px 0;">
                    ${getWeatherIcon(hour.weather[0].main)}
                </div>
                <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 5px;">
                    ${hour.weather[0].main}
                </div>
                <div style="font-weight: 600; font-size: 1.1rem;">
                    ${Math.round(hour.main.temp)}${tempUnit}
                </div>
            </div>
        `;
    }).join('');
}

function displayDailyForecast(forecastList) {
    const dailyData = {};
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';
    
    // Group by date
    forecastList.forEach(item => {
        const date = new Date(item.dt * 1000).toLocaleDateString();
        if (!dailyData[date]) {
            dailyData[date] = {
                temps: [],
                weather: item.weather[0],
                date: new Date(item.dt * 1000)
            };
        }
        dailyData[date].temps.push(item.main.temp);
    });

    const container = document.getElementById('forecastGrid');
    const days = Object.values(dailyData).slice(0, 5);
    
    container.innerHTML = days.map((day, index) => {
        const maxTemp = Math.round(Math.max(...day.temps));
        const minTemp = Math.round(Math.min(...day.temps));
        const dayName = index === 0 
            ? 'Today' 
            : day.date.toLocaleDateString('en-US', { weekday: 'short' });
        const fullDate = day.date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        
        return `
            <div class="forecast-card" tabindex="0" role="button" 
                 aria-label="Weather for ${dayName}: ${day.weather.description}, high ${maxTemp}, low ${minTemp}">
                <div class="forecast-day">${dayName}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 5px;">
                    ${fullDate}
                </div>
                <div class="forecast-icon">${getWeatherIcon(day.weather.main)}</div>
                <div style="color: var(--text-secondary); margin: 5px 0; text-transform: capitalize;">
                    ${day.weather.description}
                </div>
                <div class="forecast-temp">
                    <span style="color: var(--error);">${maxTemp}°</span> / 
                    <span style="color: var(--accent);">${minTemp}°</span>
                </div>
            </div>
        `;
    }).join('');
}

function getWeatherIcon(condition) {
    const icons = {
        'Clear': '☀️',
        'Clouds': '☁️',
        'Rain': '🌧️',
        'Drizzle': '🌦️',
        'Thunderstorm': '⛈️',
        'Snow': '❄️',
        'Mist': '🌫️',
        'Smoke': '🌫️',
        'Haze': '🌫️',
        'Dust': '🌫️',
        'Fog': '🌫️',
        'Sand': '🌫️',
        'Ash': '🌋',
        'Squall': '💨',
        'Tornado': '🌪️'
    };
    return icons[condition] || '🌤️';
}

// ===================================
// FAVORITES MANAGEMENT
// ===================================

function loadFavorites() {
    const saved = localStorage.getItem('weatherFavorites');
    favorites = saved ? JSON.parse(saved) : [];
    displayFavorites();
}

function addToFavorites() {
    if (!currentLocationData) {
        showError('No location data available');
        return;
    }
    
    const location = currentLocationData.current.name;
    
    if (favorites.includes(location)) {
        showError('Location already in favorites');
        return;
    }
    
    favorites.push(location);
    localStorage.setItem('weatherFavorites', JSON.stringify(favorites));
    displayFavorites();
    
    // Visual feedback
    const btn = document.getElementById('addFavorite');
    const originalText = btn.textContent;
    btn.textContent = '✓ Added!';
    btn.style.background = 'var(--success)';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
    }, 2000);
}

function removeFromFavorites(location) {
    favorites = favorites.filter(fav => fav !== location);
    localStorage.setItem('weatherFavorites', JSON.stringify(favorites));
    displayFavorites();
}

function displayFavorites() {
    const container = document.getElementById('favoritesGrid');
    
    if (favorites.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">No favorites added yet. Click "Add to Favorites" to save locations.</p>';
        return;
    }

    container.innerHTML = favorites.map(fav => `
        <div class="favorite-item" onclick="fetchWeatherByCity('${fav}')" role="button" tabindex="0">
            <span>📍 ${fav}</span>
            <button class="remove-fav" 
                    onclick="event.stopPropagation(); removeFromFavorites('${fav}')" 
                    aria-label="Remove ${fav} from favorites"
                    title="Remove from favorites">
                ×
            </button>
        </div>
    `).join('');
}

// ===================================
// RECENT SEARCHES
// ===================================

function loadRecentSearches() {
    const saved = localStorage.getItem('weatherRecentSearches');
    recentSearches = saved ? JSON.parse(saved) : [];
    displayRecentSearches();
}

function addToRecentSearches(city) {
    // Remove if already exists
    recentSearches = recentSearches.filter(search => search !== city);
    
    // Add to beginning
    recentSearches.unshift(city);
    
    // Keep only last 5
    recentSearches = recentSearches.slice(0, 5);
    
    localStorage.setItem('weatherRecentSearches', JSON.stringify(recentSearches));
    displayRecentSearches();
}

function displayRecentSearches() {
    const container = document.getElementById('recentSearches');
    
    if (recentSearches.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <p style="margin: 15px 0 10px 0; color: var(--text-secondary); font-size: 0.9rem;">
            Recent Searches:
        </p>
        <div>
            ${recentSearches.map(search => `
                <span class="recent-tag" 
                      onclick="fetchWeatherByCity('${search}')" 
                      role="button" 
                      tabindex="0">
                    ${search}
                </span>
            `).join('')}
        </div>
    `;
}

// ===================================
// UI HELPERS
// ===================================

function showLoading(show) {
    const loadingElement = document.getElementById('loadingState');
    loadingElement.style.display = show ? 'block' : 'none';
    
    if (!show) {
        // Hide error message when loading completes successfully
        hideError();
    }
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.classList.add('active');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        hideError();
    }, 5000);
}

function hideError() {
    const errorElement = document.getElementById('errorMessage');
    errorElement.classList.remove('active');
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(timestamp) {
    return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ===================================
// ERROR HANDLING
// ===================================

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// ===================================
// PERFORMANCE MONITORING
// ===================================

if ('performance' in window) {
    window.addEventListener('load', () => {
        const perfData = performance.timing;
        const loadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`Page load time: ${loadTime}ms`);
    });
}

console.log('Weather Dashboard script loaded successfully');