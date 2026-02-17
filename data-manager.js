// data-manager.js

// Function to export data as a JSON file
function exportData() {
  try {
    // Create a data object containing all necessary settings and database information
    const data = {
      raceSettings: {
        raceName: document.getElementById("setting-race-name").value,
        location: document.getElementById("setting-location").value,
        session: document.getElementById("setting-session").value,
        timeOfDay: document.getElementById("setting-tod").value,
        startType: document.getElementById("setting-start-type").value,
        totalLaps: document.getElementById("total-laps").value
      },
      pilots: typeof pilots !== 'undefined' ? pilots : [],
      teams: typeof teams !== 'undefined' ? teams : [],
      ships: typeof ships !== 'undefined' ? ships : [],
      controls: typeof controlsList !== 'undefined' ? controlsList : (typeof controls !== 'undefined' ? controls : [])
    };

    // Convert the data object to a JSON string and create a blob
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create a temporary URL for the blob and create an anchor element to trigger the download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Generate a timestamped filename for the download
    const timestamp = new Date().toISOString().split('T')[0];
    a.download = `circus-racing-full-data-${timestamp}.json`;
    
    // Append the anchor element to the body, trigger the click event, and clean up
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
  }
}

// Function to open a file input for importing data
function importData() {
  const fileInput = document.getElementById('import-file-input');
  if (fileInput) fileInput.click();
}

// Event handler function to handle the file selection and parsing
function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Create a FileReader to read the selected file
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      // Parse the JSON data from the file
      const data = JSON.parse(e.target.result);
      
      // Ask for confirmation before overwriting existing data
      if (confirm('Import data? This will overwrite current settings and database.')) {
        // Import race settings
        if (data.raceSettings) {
          const s = data.raceSettings;
          if (s.raceName !== undefined) document.getElementById("setting-race-name").value = s.raceName;
          if (s.location !== undefined) document.getElementById("setting-location").value = s.location;
          if (s.session !== undefined) document.getElementById("setting-session").value = s.session;
          if (s.timeOfDay !== undefined) document.getElementById("setting-tod").value = s.timeOfDay;
          if (s.startType !== undefined) document.getElementById("setting-start-type").value = s.startType;
          if (s.totalLaps !== undefined) document.getElementById("total-laps").value = s.totalLaps;
        }

        // Import database
        if (data.pilots) pilots = data.pilots;
        if (data.teams) teams = data.teams;
        if (data.ships) ships = data.ships;
        if (data.controls) {
          if (typeof controlsList !== 'undefined') controlsList = data.controls;
          if (typeof controls !== 'undefined') controls = data.controls;
        }

        // Save and refresh the display
        if (typeof saveAllToLocal === 'function') saveAllToLocal();
        if (typeof displayRace === 'function') displayRace();
        if (typeof displayPilots === 'function') displayPilots();
        if (typeof displayTeams === 'function') displayTeams();
        if (typeof displayShips === 'function') displayShips();
        if (typeof displayControls === 'function') displayControls();
        
        alert('All data and settings imported!');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Error reading file.');
    }
  };
  reader.readAsText(file);
  event.target.value = ''; 
}

// Function to reset all data by clearing local storage and reloading the page
function resetAllData() {
  if (confirm('Delete everything?')) {
    localStorage.clear();
    location.reload();
  }
}


