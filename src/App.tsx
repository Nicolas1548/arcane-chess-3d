import React from 'react';
import { Scene3D } from './components/three/Scene3D';
import { HUD } from './components/ui/HUD';

export function App() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-slate-950 relative select-none">
      <Scene3D />
      <HUD />
    </main>
  );
}

export default App;
