import React, { useState, useEffect } from 'react';

function MainMenu({ playerName = '', setPlayerName = () => {}, lobbies = [], onCreateLobby = () => {}, onJoinLobby = () => {}, connected = false }) {
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [drips, setDrips] = useState([]);
  const [cracks, setCracks] = useState([]);

  // Generate water drips animation
  useEffect(() => {
    const newDrips = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 2 + Math.random() * 3
    }));
    setDrips(newDrips);

    // Generate random cracks
    const newCracks = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 1
    }));
    setCracks(newCracks);
  }, []);

  const handleJoinByCode = () => {
    if (joinCode.trim()) {
      onJoinLobby(joinCode.trim().toUpperCase());
      setJoinCode('');
      setShowJoinInput(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #1a1410 0%, #2d1f1a 50%, #0a0806 100%)',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: '"Courier New", monospace'
    }}>
      {/* Crumbling wall texture overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px),
          repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)
        `,
        opacity: 0.3,
        pointerEvents: 'none'
      }} />

      {/* Rust and grime stains */}
      <div style={{
        position: 'absolute',
        top: '10%',
        right: '5%',
        width: '200px',
        height: '300px',
        background: 'radial-gradient(ellipse at center, rgba(139, 69, 19, 0.3), transparent 70%)',
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%',
        left: '10%',
        width: '250px',
        height: '250px',
        background: 'radial-gradient(ellipse at center, rgba(20, 20, 20, 0.5), transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }} />

      {/* Oil spill at bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '150px',
        background: 'linear-gradient(to top, rgba(10, 8, 6, 0.9), transparent)',
        pointerEvents: 'none'
      }}>
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '20%',
          width: '60%',
          height: '40px',
          background: 'radial-gradient(ellipse at center, rgba(30, 25, 20, 0.8), rgba(15, 12, 10, 0.6))',
          borderRadius: '50%',
          filter: 'blur(8px)',
          boxShadow: '0 0 30px rgba(139, 69, 19, 0.3)'
        }} />
      </div>

      {/* Water drips */}
      {drips.map(drip => (
        <div
          key={drip.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${drip.left}%`,
            width: '2px',
            height: '20px',
            background: 'linear-gradient(to bottom, rgba(100, 120, 140, 0.4), rgba(100, 120, 140, 0.1))',
            animation: `drip ${drip.duration}s ease-in infinite`,
            animationDelay: `${drip.delay}s`,
            pointerEvents: 'none'
          }}
        />
      ))}

      {/* Wall cracks */}
      {cracks.map(crack => (
        <div
          key={crack.id}
          style={{
            position: 'absolute',
            left: `${crack.left}%`,
            top: `${crack.top}%`,
            width: '100px',
            height: '2px',
            background: 'linear-gradient(to right, transparent, rgba(0, 0, 0, 0.6), transparent)',
            transform: `rotate(${crack.rotation}deg) scale(${crack.scale})`,
            pointerEvents: 'none'
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            width: '2px',
            height: '50px',
            background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent)',
            transform: 'translateX(-50%)'
          }} />
        </div>
      ))}

      <style>{`
        @keyframes drip {
          0% { transform: translateY(0); opacity: 0.8; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      <div style={{
        maxWidth: '500px',
        margin: '0 auto',
        padding: '40px 20px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Distressed title with flickering effect */}
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
          position: 'relative'
        }}>
          <h1 style={{
            fontSize: '3.5rem',
            fontWeight: 'bold',
            color: '#8B7355',
            textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
            letterSpacing: '8px',
            margin: '0',
            animation: 'flicker 3s ease-in-out infinite',
            position: 'relative',
            transform: 'skew(-2deg)'
          }}>
            URBAN
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '20%',
              width: '60%',
              height: '3px',
              background: 'rgba(139, 69, 19, 0.4)',
              transform: 'rotate(-2deg)'
            }} />
          </h1>
          <h1 style={{
            fontSize: '3.5rem',
            fontWeight: 'bold',
            color: '#654321',
            textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
            letterSpacing: '8px',
            margin: '0',
            transform: 'skew(-2deg)'
          }}>
            SURVIVAL
          </h1>
          <p style={{
            fontSize: '0.9rem',
            color: '#666',
            letterSpacing: '3px',
            marginTop: '10px',
            fontStyle: 'italic'
          }}>
            [ SCAVENGE • SURVIVE • ESCAPE ]
          </p>
        </div>

        {/* Warning banner */}
        <div style={{
          background: 'rgba(139, 69, 19, 0.2)',
          border: '2px solid #8B4513',
          borderRadius: '0',
          padding: '15px',
          marginBottom: '25px',
          position: 'relative',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            position: 'absolute',
            top: '-2px',
            left: '-2px',
            right: '-2px',
            bottom: '-2px',
            border: '1px solid rgba(139, 69, 19, 0.5)',
            pointerEvents: 'none'
          }} />
          <div style={{
            color: '#D2691E',
            fontSize: '0.85rem',
            textAlign: 'center',
            fontWeight: 'bold',
            letterSpacing: '1px'
          }}>
            ⚠️ CONDEMNED DISTRICT ⚠️
          </div>
          <div style={{
            color: '#8B7355',
            fontSize: '0.75rem',
            textAlign: 'center',
            marginTop: '5px',
            lineHeight: '1.4'
          }}>
            Water contaminated • Infrastructure collapsed<br/>
            Resources scarce • Survival not guaranteed
          </div>
        </div>

        {!connected && (
          <div style={{ 
            background: 'rgba(139, 0, 0, 0.3)', 
            border: '2px solid #8B0000',
            padding: '12px 20px',
            marginBottom: '20px',
            color: '#FF6347',
            textAlign: 'center',
            fontWeight: 'bold',
            letterSpacing: '1px',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
          }}>
            🔌 SIGNAL LOST... RECONNECTING...
          </div>
        )}

        {/* Player name input - distressed look */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{
            fontSize: '0.75rem',
            color: '#8B7355',
            marginBottom: '5px',
            letterSpacing: '2px',
            fontWeight: 'bold'
          }}>
            SURVIVOR IDENTIFICATION:
          </div>
          <input
            type="text"
            placeholder="Enter alias..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
            style={{
              width: '100%',
              padding: '15px',
              background: 'rgba(20, 15, 10, 0.8)',
              border: '2px solid #4A3728',
              color: '#D2B48C',
              fontSize: '1.1rem',
              fontFamily: '"Courier New", monospace',
              boxSizing: 'border-box',
              outline: 'none',
              borderRadius: '0',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5), 0 0 0 1px rgba(139, 69, 19, 0.3)'
            }}
          />
        </div>

        {/* Action buttons - weathered style */}
        <button 
          onClick={onCreateLobby}
          disabled={!playerName.trim() || !connected}
          style={{
            width: '100%',
            padding: '15px',
            marginBottom: '12px',
            background: !playerName.trim() || !connected 
              ? 'rgba(50, 40, 30, 0.5)' 
              : 'linear-gradient(to bottom, #654321, #4A3728)',
            border: '3px solid #8B7355',
            color: !playerName.trim() || !connected ? '#555' : '#D2B48C',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            cursor: !playerName.trim() || !connected ? 'not-allowed' : 'pointer',
            fontFamily: '"Courier New", monospace',
            letterSpacing: '2px',
            textShadow: '2px 2px 0 #000',
            boxShadow: !playerName.trim() || !connected 
              ? 'none' 
              : '0 4px 0 #2d1f1a, inset 0 0 0 1px rgba(139, 115, 85, 0.3)',
            transform: 'skew(-1deg)',
            transition: 'all 0.2s',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            if (playerName.trim() && connected) {
              e.currentTarget.style.background = 'linear-gradient(to bottom, #8B6F47, #654321)';
              e.currentTarget.style.transform = 'skew(-1deg) translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            if (playerName.trim() && connected) {
              e.currentTarget.style.background = 'linear-gradient(to bottom, #654321, #4A3728)';
              e.currentTarget.style.transform = 'skew(-1deg)';
            }
          }}
        >
          🏚️ ESTABLISH SAFEHOUSE
        </button>

        {showJoinInput ? (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="CODE..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8}
              style={{
                flex: 1,
                padding: '15px',
                background: 'rgba(20, 15, 10, 0.8)',
                border: '2px solid #4A3728',
                color: '#D2B48C',
                fontSize: '1.1rem',
                fontFamily: '"Courier New", monospace',
                outline: 'none',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)'
              }}
            />
            <button 
              onClick={handleJoinByCode}
              disabled={!joinCode.trim() || !playerName.trim()}
              style={{
                padding: '15px 25px',
                background: !joinCode.trim() || !playerName.trim() 
                  ? 'rgba(50, 40, 30, 0.5)' 
                  : '#4A3728',
                border: '2px solid #8B7355',
                color: !joinCode.trim() || !playerName.trim() ? '#555' : '#D2B48C',
                fontWeight: 'bold',
                cursor: !joinCode.trim() || !playerName.trim() ? 'not-allowed' : 'pointer',
                fontFamily: '"Courier New", monospace',
                letterSpacing: '1px'
              }}
            >
              ENTER
            </button>
            <button 
              onClick={() => setShowJoinInput(false)}
              style={{
                padding: '15px 20px',
                background: '#2d1f1a',
                border: '2px solid #4A3728',
                color: '#8B7355',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: '"Courier New", monospace',
                letterSpacing: '1px'
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setShowJoinInput(true)}
            disabled={!playerName.trim() || !connected}
            style={{
              width: '100%',
              padding: '15px',
              marginBottom: '12px',
              background: !playerName.trim() || !connected 
                ? 'rgba(50, 40, 30, 0.5)' 
                : 'rgba(45, 31, 26, 0.9)',
              border: '2px solid #654321',
              color: !playerName.trim() || !connected ? '#555' : '#8B7355',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: !playerName.trim() || !connected ? 'not-allowed' : 'pointer',
              fontFamily: '"Courier New", monospace',
              letterSpacing: '2px',
              transform: 'skew(-1deg)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (playerName.trim() && connected) {
                e.currentTarget.style.background = 'rgba(70, 50, 40, 0.9)';
              }
            }}
            onMouseLeave={(e) => {
              if (playerName.trim() && connected) {
                e.currentTarget.style.background = 'rgba(45, 31, 26, 0.9)';
              }
            }}
          >
            🔑 JOIN BY ACCESS CODE
          </button>
        )}

        {/* Available lobbies - makeshift board style */}
        {lobbies.length > 0 && (
          <div style={{
            background: 'rgba(10, 8, 6, 0.7)',
            border: '3px solid #4A3728',
            padding: '20px',
            marginTop: '25px',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.7), 0 0 0 1px rgba(139, 69, 19, 0.2)',
            position: 'relative'
          }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: 'bold',
              color: '#8B7355',
              marginBottom: '15px',
              letterSpacing: '2px',
              borderBottom: '2px solid #4A3728',
              paddingBottom: '10px',
              textAlign: 'center'
            }}>
              📋 NEARBY SAFEHOUSES
            </div>
            {lobbies.map((lobby) => (
              <div 
                key={lobby.id}
                onClick={() => playerName.trim() && onJoinLobby(lobby.id)}
                style={{
                  background: 'rgba(45, 31, 26, 0.6)',
                  border: '2px solid #654321',
                  padding: '15px',
                  marginBottom: '10px',
                  cursor: playerName.trim() ? 'pointer' : 'not-allowed',
                  opacity: playerName.trim() ? 1 : 0.5,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (playerName.trim()) {
                    e.currentTarget.style.background = 'rgba(70, 50, 40, 0.8)';
                    e.currentTarget.style.transform = 'translateX(5px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (playerName.trim()) {
                    e.currentTarget.style.background = 'rgba(45, 31, 26, 0.6)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }
                }}
              >
                <div>
                  <div style={{ 
                    fontWeight: 'bold', 
                    color: '#D2B48C',
                    fontSize: '1rem',
                    marginBottom: '5px'
                  }}>
                    🏚️ {lobby.hostName}'s Shelter
                  </div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: '#8B7355',
                    fontFamily: '"Courier New", monospace',
                    letterSpacing: '1px'
                  }}>
                    ACCESS: {lobby.id}
                  </div>
                </div>
                <div style={{ 
                  background: 'rgba(139, 69, 19, 0.3)',
                  border: '2px solid #8B7355',
                  padding: '8px 15px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  color: '#D2B48C',
                  letterSpacing: '1px'
                }}>
                  {lobby.playerCount}/{lobby.maxPlayers}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Controls guide - worn paper style */}
        <div style={{
          marginTop: '30px',
          background: 'rgba(45, 31, 26, 0.4)',
          border: '2px dashed #4A3728',
          padding: '20px',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            fontSize: '0.7rem',
            color: '#8B7355',
            lineHeight: '1.8',
            fontFamily: '"Courier New", monospace'
          }}>
            <div style={{ marginBottom: '8px', borderBottom: '1px solid #4A3728', paddingBottom: '8px' }}>
              <strong style={{ color: '#D2691E' }}>MOVEMENT:</strong> WASD Keys
            </div>
            <div style={{ marginBottom: '8px', borderBottom: '1px solid #4A3728', paddingBottom: '8px' }}>
              <strong style={{ color: '#D2691E' }}>COMBAT:</strong> Mouse Aim • Click Attack
            </div>
            <div style={{ marginBottom: '8px', borderBottom: '1px solid #4A3728', paddingBottom: '8px' }}>
              <strong style={{ color: '#D2691E' }}>WEAPONS:</strong> Keys 1/2 Switch
            </div>
            <div>
              <strong style={{ color: '#D2691E' }}>INTERACT:</strong> E Key • Middle-Click Signal
            </div>
          </div>
        </div>

        {/* Poverty flavor text */}
        <div style={{
          marginTop: '20px',
          textAlign: 'center',
          color: '#654321',
          fontSize: '0.7rem',
          fontStyle: 'italic',
          lineHeight: '1.6',
          opacity: 0.7
        }}>
          "The buildings weep rust and despair...<br/>
          Every shadow hides hunger...<br/>
          Only the desperate survive here."
        </div>
      </div>
    </div>
  );
}

export default MainMenu;