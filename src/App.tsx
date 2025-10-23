import MapDisplay from './components/MapDisplay';

import gameData from './data/ubersreik.json'; 

import './App.css';

function App() {
  
  return (
    <div className="App">
      <MapDisplay gameData={gameData} />
    </div>
  );
}

export default App;