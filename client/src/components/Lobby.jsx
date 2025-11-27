import React, { useState, useEffect } from 'react';

function Lobby({ lobby, playerId, onLeave, onSetReady, onStartGame }) {
  const [warningBlink, setWarningBlink] = useState(true);
  const [staticLines, setStaticLines] = useState([]);

  useEffect(() => {
    // Blinking warning effect
    const blinkInterval = setInterval(() => {
      setWarningBlink(prev => !prev);
    }, 800);

    // Generate random static lines
    const lines = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      top: Math.random() * 100,
      width: 20 + Math.random() * 60,
      left: Math.random() * 100,
      opacity: 0.1 + Math.random() * 0.2
    }));
    setStaticLines(lines);

    return () => clearInterval(blinkInterval);
  }, []);

  if (!lobby) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #1a1410 0%, #2d1f1a 50%, #0a0806 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Courier New", monospace'
      }}>
        <div style={{ color: '#8B7355', fontSize: '1.5rem', letterSpacing: '3px' }}>
          ACCESSING SAFEHOUSE...
        </div>
      </div>
    );
  }

  const currentPlayer = lobby.players.find(p => p.id === playerId);
  const isHost = currentPlayer?.isHost || false;
  const isReady = currentPlayer?.ready || false;
  
  const allReady = lobby.players.every(p => p.isHost || p.ready);
  const canStart = isHost && allReady && lobby.players.length >= 1;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #1a1410 0%, #2d1f1a 50%, #0a0806 100%)',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: '"Courier New", monospace',
      padding: '20px'
    }}>
      {/* Background texture */}
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

      {/* Static interference lines */}
      {staticLines.map(line => (
        <div
          key={line.id}
          style={{
            position: 'absolute',
            top: `${line.top}%`,
            left: `${line.left}%`,
            width: `${line.width}%`,
            height: '1px',
            background: '#8B7355',
            opacity: line.opacity,
            pointerEvents: 'none'
          }}
        />
      ))}

      <div style={{
        maxWidth: '700px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header with distressed look */}
        <div style={{
          background: 'rgba(10, 8, 6, 0.8)',
          border: '3px solid #4A3728',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.7), 0 0 0 1px rgba(139, 69, 19, 0.2)',
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '15px'
          }}>
            <div>
              <h2 style={{ 
                margin: 0, 
                color: '#D2691E',
                fontSize: '2rem',
                letterSpacing: '3px',
                textShadow: '2px 2px 0 #000',
                transform: 'skew(-2deg)'
              }}>
                🏚️ SAFEHOUSE
              </h2>
              <p style={{ 
                margin: '8px 0 0', 
                color: '#8B7355',
                fontSize: '0.85rem',
                letterSpacing: '2px'
              }}>
                ASSEMBLING SURVIVORS...
              </p>
            </div>
            <div style={{
              background: 'rgba(139, 69, 19, 0.3)',
              border: '2px solid #8B7355',
              padding: '10px 20px',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: '#D2B48C',
              letterSpacing: '2px',
              boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
            }}>
              {lobby.id}
            </div>
          </div>

          {/* Critical warning banner */}
          <div style={{
            background: 'rgba(139, 0, 0, 0.3)',
            border: '3px double #8B0000',
            padding: '15px',
            marginTop: '15px',
            position: 'relative',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              position: 'absolute',
              top: '-2px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#1a1410',
              padding: '0 10px',
              color: '#FF6347',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              letterSpacing: '2px'
            }}>
              ⚠️ WARNING ⚠️
            </div>
            <div style={{
              color: '#FF6347',
              fontSize: '0.8rem',
              textAlign: 'center',
              lineHeight: '1.6',
              fontWeight: 'bold',
              letterSpacing: '1px',
              marginTop: '8px',
              opacity: warningBlink ? 1 : 0.6,
              transition: 'opacity 0.3s'
            }}>
              ONCE THE MISSION BEGINS<br/>
              THERE IS NO TURNING BACK<br/>
              <span style={{ fontSize: '0.7rem', color: '#D2691E' }}>
                [ SURVIVAL RATE: 12% ]
              </span>
            </div>
          </div>
        </div>

        {/* Players list - bunker roster style */}
        <div style={{
          background: 'rgba(10, 8, 6, 0.7)',
          border: '3px solid #4A3728',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.7)'
        }}>
          <h3 style={{ 
            marginBottom: '15px', 
            color: '#8B7355',
            fontSize: '1rem',
            letterSpacing: '2px',
            borderBottom: '2px solid #4A3728',
            paddingBottom: '10px',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>📋 SURVIVOR ROSTER</span>
            <span style={{ color: '#D2691E' }}>
              [{lobby.players.length}/{lobby.maxPlayers}]
            </span>
          </h3>
          
          {lobby.players.map((player, index) => (
            <div 
              key={`${player.id}-${index}`}
              style={{
                background: player.ready 
                  ? 'rgba(70, 50, 40, 0.6)' 
                  : 'rgba(45, 31, 26, 0.6)',
                border: player.isHost 
                  ? '3px solid #D2691E' 
                  : '2px solid #654321',
                padding: '15px',
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: player.ready 
                  ? 'inset 0 0 15px rgba(139, 69, 19, 0.3), 0 0 10px rgba(139, 69, 19, 0.2)' 
                  : 'inset 0 0 10px rgba(0,0,0,0.5)',
                transition: 'all 0.3s',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Ready indicator stripe */}
              {player.ready && !player.isHost && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '4px',
                  background: 'linear-gradient(to bottom, #8B4513, #D2691E)',
                  boxShadow: '0 0 10px #D2691E'
                }} />
              )}

              <div>
                <span style={{
                  color: player.isHost ? '#FFD700' : '#D2B48C',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  letterSpacing: '1px'
                }}>
                  {player.isHost ? '★ ' : ''}
                  {player.name}
                </span>
                {player.id === playerId && (
                  <span style={{ 
                    color: '#8B7355', 
                    marginLeft: '10px',
                    fontSize: '0.85rem',
                    fontStyle: 'italic'
                  }}>
                    (YOU)
                  </span>
                )}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {player.isHost && (
                  <span style={{ 
                    background: 'linear-gradient(to bottom, #FFD700, #DAA520)', 
                    color: '#000', 
                    padding: '5px 12px', 
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    letterSpacing: '1px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)'
                  }}>
                    LEADER
                  </span>
                )}
                <span style={{
                  background: player.ready 
                    ? 'rgba(139, 69, 19, 0.5)' 
                    : 'rgba(50, 40, 30, 0.5)',
                  color: player.ready ? '#90EE90' : '#666',
                  padding: '6px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  border: player.ready 
                    ? '2px solid #8B7355' 
                    : '2px solid #4A3728',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
                }}>
                  {player.isHost ? '🔧 READY' : player.ready ? '✓ READY' : '⏳ WAITING'}
                </span>
              </div>
            </div>
          ))}

          {/* Empty slots */}
          {lobby.players.length < lobby.maxPlayers && (
            <div style={{
              background: 'rgba(20, 15, 10, 0.3)',
              border: '2px dashed #4A3728',
              padding: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.4,
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
            }}>
              <span style={{ 
                color: '#654321',
                fontSize: '0.9rem',
                letterSpacing: '2px'
              }}>
                --- AWAITING RECRUIT ---
              </span>
            </div>
          )}
        </div>

        {/* Point of no return warning */}
        {isHost && allReady && (
          <div style={{
            background: 'rgba(139, 0, 0, 0.2)',
            border: '3px solid #8B0000',
            padding: '20px',
            marginBottom: '20px',
            textAlign: 'center',
            boxShadow: 'inset 0 0 30px rgba(139, 0, 0, 0.3), 0 0 20px rgba(139, 0, 0, 0.2)',
            position: 'relative'
          }}>
            <div style={{
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: '#FF6347',
              letterSpacing: '2px',
              marginBottom: '10px',
              textShadow: '2px 2px 0 #000'
            }}>
              ☠️ POINT OF NO RETURN ☠️
            </div>
            <div style={{
              fontSize: '0.8rem',
              color: '#D2691E',
              lineHeight: '1.6',
              letterSpacing: '1px'
            }}>
              Once you venture into the wasteland,<br/>
              extraction is not guaranteed.<br/>
              <span style={{ color: '#8B7355', fontSize: '0.7rem' }}>
                May fortune favor the desperate...
              </span>
            </div>
          </div>
        )}

        {/* Action buttons - reinforced metal style */}
        <div style={{
          display: 'flex',
          gap: '15px',
          marginBottom: '20px'
        }}>
          <button 
            onClick={onLeave}
            style={{
              flex: 1,
              padding: '18px',
              background: 'linear-gradient(to bottom, #2d1f1a, #1a1410)',
              border: '3px solid #4A3728',
              color: '#8B7355',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: '"Courier New", monospace',
              letterSpacing: '2px',
              textShadow: '1px 1px 0 #000',
              boxShadow: '0 4px 0 #0a0806, inset 0 0 0 1px rgba(139, 115, 85, 0.2)',
              transition: 'all 0.2s',
              transform: 'skew(-1deg)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to bottom, #3d2f2a, #2d1f1a)';
              e.currentTarget.style.transform = 'skew(-1deg) translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to bottom, #2d1f1a, #1a1410)';
              e.currentTarget.style.transform = 'skew(-1deg)';
            }}
          >
            🚪 ABANDON SAFEHOUSE
          </button>

          {!isHost && (
            <button 
              onClick={() => onSetReady(!isReady)}
              style={{
                flex: 1,
                padding: '18px',
                background: isReady 
                  ? 'linear-gradient(to bottom, #8B6F47, #654321)'
                  : 'linear-gradient(to bottom, #654321, #4A3728)',
                border: '3px solid #8B7355',
                color: isReady ? '#FFD700' : '#D2B48C',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: '"Courier New", monospace',
                letterSpacing: '2px',
                textShadow: '2px 2px 0 #000',
                boxShadow: '0 4px 0 #2d1f1a, inset 0 0 0 1px rgba(139, 115, 85, 0.3)',
                transition: 'all 0.2s',
                transform: 'skew(-1deg)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'skew(-1deg) translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'skew(-1deg)';
              }}
            >
              {isReady ? '✗ CANCEL READY' : '✓ CONFIRM READY'}
            </button>
          )}

          {isHost && (
            <button 
              onClick={onStartGame}
              disabled={!canStart}
              style={{
                flex: 1,
                padding: '18px',
                background: !canStart 
                  ? 'rgba(50, 40, 30, 0.5)'
                  : 'linear-gradient(to bottom, #8B0000, #650000)',
                border: !canStart 
                  ? '3px solid #4A3728'
                  : '3px solid #FF4500',
                color: !canStart ? '#555' : '#FFD700',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: !canStart ? 'not-allowed' : 'pointer',
                fontFamily: '"Courier New", monospace',
                letterSpacing: '2px',
                textShadow: !canStart ? 'none' : '2px 2px 0 #000',
                boxShadow: !canStart 
                  ? 'inset 0 0 20px rgba(0,0,0,0.5)'
                  : '0 4px 0 #2d1f1a, inset 0 0 0 1px rgba(255, 69, 0, 0.3), 0 0 20px rgba(255, 69, 0, 0.3)',
                transition: 'all 0.2s',
                transform: 'skew(-1deg)',
                opacity: !canStart ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (canStart) {
                  e.currentTarget.style.background = 'linear-gradient(to bottom, #A00000, #8B0000)';
                  e.currentTarget.style.transform = 'skew(-1deg) translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 0 #2d1f1a, inset 0 0 0 1px rgba(255, 69, 0, 0.5), 0 0 30px rgba(255, 69, 0, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (canStart) {
                  e.currentTarget.style.background = 'linear-gradient(to bottom, #8B0000, #650000)';
                  e.currentTarget.style.transform = 'skew(-1deg)';
                  e.currentTarget.style.boxShadow = '0 4px 0 #2d1f1a, inset 0 0 0 1px rgba(255, 69, 0, 0.3), 0 0 20px rgba(255, 69, 0, 0.3)';
                }
              }}
            >
              {lobby.players.length === 1 
                ? '⚠️ VENTURE ALONE' 
                : allReady 
                  ? '☠️ BEGIN MISSION' 
                  : '⏳ WAITING...'}
            </button>
          )}
        </div>

        {/* Sharing instructions - worn paper */}
        <div style={{
          background: 'rgba(45, 31, 26, 0.4)',
          border: '2px dashed #4A3728',
          padding: '15px',
          textAlign: 'center',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
          marginBottom: '20px'
        }}>
          <div style={{
            color: '#8B7355',
            fontSize: '0.85rem',
            lineHeight: '1.6',
            letterSpacing: '1px'
          }}>
            📡 Share access code <strong style={{ color: '#D2691E' }}>{lobby.id}</strong> with fellow survivors
          </div>
        </div>

        {/* Atmospheric flavor text */}
        <div style={{
          textAlign: 'center',
          padding: '20px',
          borderTop: '1px solid #4A3728'
        }}>
          <div style={{
            color: '#654321',
            fontSize: '0.75rem',
            fontStyle: 'italic',
            lineHeight: '1.8',
            opacity: 0.7,
            letterSpacing: '1px'
          }}>
            "In the ruins, trust is currency...<br/>
            But even allies can't promise tomorrow...<br/>
            <span style={{ color: '#8B4513' }}>The wasteland takes everyone eventually."</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Lobby;