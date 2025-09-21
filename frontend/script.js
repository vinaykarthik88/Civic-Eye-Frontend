function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            document.getElementById('lat').value = position.coords.latitude;
            document.getElementById('lng').value = position.coords.longitude;
        }, (error) => {
            alert('Error getting location: ' + error.message);
        });
    } else {
        alert('Geolocation not supported.');
    }
}

function validateDarpanId(id) {
    return /^[a-zA-Z0-9]{6,}$/.test(id); // Simple alphanumeric check, min 6 chars
}

function getDarpanUser(isNgoCheckbox, inputId) {
    const baseId = document.getElementById(inputId).value.trim();
    if (!baseId || !validateDarpanId(baseId)) {
        alert('Invalid Darpan ID: Must be alphanumeric and at least 6 characters.');
        return null;
    }
    return document.getElementById(isNgoCheckbox).checked ? 'NGO_' + baseId : baseId;
}

function initUser(username) {
    let users = JSON.parse(localStorage.getItem('users')) || {};
    if (!users[username]) {
        users[username] = { points: 0, level: 1 };
        localStorage.setItem('users', JSON.stringify(users));
    }
    return users;
}

function updateUserPoints(username, addPoints) {
    let users = JSON.parse(localStorage.getItem('users')) || {};
    if (users[username]) {
        users[username].points += addPoints;
        users[username].level = Math.floor(users[username].points / 10) + 1;
        localStorage.setItem('users', JSON.stringify(users));
    }
}

function getCurrentUser() {
    return localStorage.getItem('currentUser');
}

function saveCurrentUser(username) {
    localStorage.setItem('currentUser', username);
}

function loadUserForForm(formType) {
    const currentUser = getCurrentUser();
    if (currentUser) {
        const section = document.getElementById(formType === 'reportForm' ? 'usernameSection' : 'validatorUsernameSection');
        const input = document.getElementById(formType === 'reportForm' ? 'username' : 'validatorUsername');
        const checkbox = document.getElementById(formType === 'reportForm' ? 'isNgo' : 'validatorIsNgo');
        input.value = currentUser.startsWith('NGO_') ? currentUser.substring(4) : currentUser;
        checkbox.checked = currentUser.startsWith('NGO_');
        section.style.display = 'block'; // Keep visible but pre-filled
    }
}

function toggleNgoLogin(event) {
    const checkbox = event.target;
    const help = document.getElementById(checkbox.id === 'isNgo' ? 'usernameHelp' : 'validatorHelp');
    if (checkbox.checked) {
        help.textContent = 'NGO mode enabled. Verify your Darpan ID at ngodarpan.gov.in.';
    } else {
        help.textContent = 'Alphanumeric, min 6 chars. NGOs: Check box for prefix.';
    }
}

function submitReport(event) {
    event.preventDefault();
    const username = getDarpanUser('isNgo', 'username');
    if (!username) return;

    saveCurrentUser(username);

    const description = document.getElementById('description').value;
    const type = document.getElementById('type').value;
    const lat = document.getElementById('lat').value;
    const lng = document.getElementById('lng').value;
    const imageFile = document.getElementById('image').files[0];

    if (!description || !type || !lat || !lng) {
        alert('Please fill all fields.');
        return;
    }

    if (description.length < 10) {
        alert('Description too short (mock spam filter).');
        return;
    }

    initUser(username);

    const reader = new FileReader();
    reader.onload = function(e) {
        const imageBase64 = e.target.result;
        const hazard = {
            id: Date.now(),
            reporter: username,
            description,
            type,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            image: imageBase64,
            status: 'pending',
            validation_status: 'pending',
            votes: { true: 0, false: 0 },
            resolvedBy: null
        };

        let hazards = JSON.parse(localStorage.getItem('hazards')) || [];
        hazards.push(hazard);
        localStorage.setItem('hazards', JSON.stringify(hazards));

        document.getElementById('status').textContent = 'Report submitted! It will appear in Validate Hazards for review.';
        document.getElementById('reportForm').reset();
        document.getElementById('isNgo').checked = false; // Reset checkbox
    };

    if (imageFile) {
        reader.readAsDataURL(imageFile);
    } else {
        // No image case (similar to above)
        const hazard = {
            id: Date.now(),
            reporter: username,
            description,
            type,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            image: null,
            status: 'pending',
            validation_status: 'pending',
            votes: { true: 0, false: 0 },
            resolvedBy: null
        };
        let hazards = JSON.parse(localStorage.getItem('hazards')) || [];
        hazards.push(hazard);
        localStorage.setItem('hazards', JSON.stringify(hazards));
        document.getElementById('status').textContent = 'Report submitted! It will appear in Validate Hazards for review.';
        document.getElementById('reportForm').reset();
        document.getElementById('isNgo').checked = false;
    }
}

function loadValidatedHazards() {
    const hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    const urgencyMap = { air: 3, water: 2, waste: 1 };
    const filtered = hazards.filter(h => h.validation_status === 'valid')
        .sort((a, b) => urgencyMap[b.type] - urgencyMap[a.type]);
    const list = document.getElementById('hazardList');
    list.innerHTML = '';

    const map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    filtered.forEach(hazard => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>Type: ${hazard.type} (Urgency: ${urgencyMap[hazard.type]})</strong><br>
            Description: ${hazard.description}<br>
            Reporter: ${hazard.reporter}<br>
            Location: (${hazard.lat}, ${hazard.lng})<br>
            Status: ${hazard.status} ${hazard.resolvedBy ? `(Resolved by: ${hazard.resolvedBy})` : ''}<br>
            ${hazard.image ? `<img src="${hazard.image}" alt="Hazard Image" style="max-width: 200px;">` : ''}
            <button onclick="updateStatus(${hazard.id}, 'resolved')">Mark Resolved</button>
        `;
        list.appendChild(li);

        L.marker([hazard.lat, hazard.lng]).addTo(map)
            .bindPopup(`${hazard.type}: ${hazard.description}`);
    });
}

function loadPendingHazards() {
    const hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    const filtered = hazards.filter(h => h.validation_status === 'pending');
    const list = document.getElementById('pendingList');
    list.innerHTML = '';

    filtered.forEach(hazard => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>Type: ${hazard.type}</strong><br>
            Description: ${hazard.description}<br>
            Reporter: ${hazard.reporter}<br>
            Location: (${hazard.lat}, ${hazard.lng})<br>
            Votes: Valid (${hazard.votes.true}) / Invalid (${hazard.votes.false})<br>
            ${hazard.image ? `<img src="${hazard.image}" alt="Hazard Image" style="max-width: 200px;">` : ''}
            <button onclick="vote(${hazard.id}, true)">Valid (True)</button>
            <button onclick="vote(${hazard.id}, false)">Invalid (False)</button>
        `;
        list.appendChild(li);
    });
}

function vote(id, isValid) {
    const username = getDarpanUser('validatorIsNgo', 'validatorUsername');
    if (!username) return;

    saveCurrentUser(username);

    initUser(username);

    let hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    hazards = hazards.map(h => {
        if (h.id === id) {
            h.votes[isValid ? 'true' : 'false']++;
            if (h.votes.true >= 3) {
                h.validation_status = 'valid';
                updateUserPoints(h.reporter, 10);
            } else if (h.votes.false >= 3) {
                h.validation_status = 'invalid';
            }
            return h;
        }
        return h;
    });
    localStorage.setItem('hazards', JSON.stringify(hazards));

    updateUserPoints(username, 1);

    loadPendingHazards();
}

function updateStatus(id, newStatus) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Login with Darpan ID required to update status.');
        return;
    }

    let hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    hazards = hazards.map(h => {
        if (h.id === id) {
            h.status = newStatus;
            h.resolvedBy = currentUser;
            if (newStatus === 'resolved' && currentUser.startsWith('NGO_')) {
                updateUserPoints(currentUser, 5);
            }
            return h;
        }
        return h;
    });
    localStorage.setItem('hazards', JSON.stringify(hazards));
    loadValidatedHazards();
}

function loadLeaderboard() {
    const users = JSON.parse(localStorage.getItem('users')) || {};
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';

    Object.entries(users)
        .sort(([, a], [, b]) => b.points - a.points)
        .forEach(([username, { points, level }]) => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${username}</strong>: ${points} points (Level ${level})`;
            list.appendChild(li);
        });
}