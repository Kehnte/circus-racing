const STORAGE_KEYS = {
  TEAMS: 'circusRacing_teams',
  SHIPS: 'circusRacing_ships',
  CONTROLS: 'circusRacing_controls',
  PILOTS: 'circusRacing_pilots'
};

function loadFromStorage() {
  try {
    const savedTeams = localStorage.getItem(STORAGE_KEYS.TEAMS);
    if (savedTeams) {
      teams = JSON.parse(savedTeams);
      console.log('Teams loaded from LocalStorage:', teams.length);
    }

    const savedShips = localStorage.getItem(STORAGE_KEYS.SHIPS);
    if (savedShips) {
      ships = JSON.parse(savedShips);
      console.log('Ships loaded from LocalStorage:', ships.length);
    }

    const savedControls = localStorage.getItem(STORAGE_KEYS.CONTROLS);
    if (savedControls) {
      controlsList = JSON.parse(savedControls);
      console.log('Controls loaded from LocalStorage:', controlsList.length);
    }

    const savedPilots = localStorage.getItem(STORAGE_KEYS.PILOTS);
    if (savedPilots) {
      pilots = JSON.parse(savedPilots);
      console.log('Pilots loaded from LocalStorage:', pilots.length);
    }
  } catch (error) {
    console.error('Error loading from LocalStorage:', error);
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
    localStorage.setItem(STORAGE_KEYS.SHIPS, JSON.stringify(ships));
    localStorage.setItem(STORAGE_KEYS.CONTROLS, JSON.stringify(controlsList));
    localStorage.setItem(STORAGE_KEYS.PILOTS, JSON.stringify(pilots));
    console.log('Data saved to LocalStorage');
  } catch (error) {
    console.error('Error saving to LocalStorage:', error);
  }
}

function resetTeams() {
  if (confirm('Are you sure you want to delete all teams?')) {
    teams = [];
    localStorage.removeItem(STORAGE_KEYS.TEAMS);
    displayTeams();
    if (typeof updateTeamDropdown === 'function') updateTeamDropdown();
    if (typeof displayPilots === 'function') displayPilots();
    console.log('All teams deleted');
  }
}

function resetShips() {
  if (confirm('Are you sure you want to delete all ships?')) {
    ships = [];
    localStorage.removeItem(STORAGE_KEYS.SHIPS);
    displayShips();
    if (typeof updateShipDropdown === 'function') updateShipDropdown();
    if (typeof displayPilots === 'function') displayPilots();
    console.log('All ships deleted');
  }
}

function resetControls() {
  if (confirm('Are you sure you want to delete all controls?')) {
    controlsList = [];
    localStorage.removeItem(STORAGE_KEYS.CONTROLS);
    displayControls();
    if (typeof updateControlDropdown === 'function') updateControlDropdown();
    if (typeof displayPilots === 'function') displayPilots();
    console.log('All controls deleted');
  }
}

function resetPilots() {
  if (confirm('Are you sure you want to delete all pilots?')) {
    pilots = [];
    localStorage.removeItem(STORAGE_KEYS.PILOTS);
    displayPilots();
    console.log('All pilots deleted');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('Loading data from LocalStorage...');
  loadFromStorage();
  
  if (typeof displayTeams === 'function') displayTeams();
  if (typeof displayShips === 'function') displayShips();
  if (typeof displayControls === 'function') displayControls();
  if (typeof displayPilots === 'function') displayPilots();
  
  if (typeof updateTeamDropdown === 'function') updateTeamDropdown();
  if (typeof updateShipDropdown === 'function') updateShipDropdown();
  if (typeof updateControlDropdown === 'function') updateControlDropdown();
});