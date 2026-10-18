// Gamepad polling (standard mapping). Pads take player slots in connection order: first pad → slot 0, second → slot 1.
// Edge-triggered: a direction or button fires once per press. The stick needs to return near centre before it repeats.
const B = { A:0, B:1, X:2, Y:3, LB:4, RB:5, BACK:8, START:9, UP:12, DOWN:13, LEFT:14, RIGHT:15 };
const prev = new Map(); // pad.index → { buttons:[], stick:-1|0|1 }

export function connectedPads(){
  return [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(p=>p && p.connected);
}

// handlers: { steer(slot, dir), pulse(slot), pause(slot), confirm(slot), back(slot), nav(slot, dir) }
export function pollGamepads(h){
  connectedPads().forEach((pad, slot)=>{
    const st = prev.get(pad.index) || { buttons:[], stick:0 };
    const down = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const pressed = i => down(i) && !st.buttons[i];

    const x = pad.axes[0] || 0, y = pad.axes[1] || 0;
    let stick = st.stick;
    if(Math.abs(x) < 0.3 && Math.abs(y) < 0.3) stick = 0;
    else if(st.stick===0){
      if(Math.abs(x) >= 0.6 && Math.abs(x) > Math.abs(y)){ stick = x>0 ? 1 : -1; h.steer(slot, stick); h.nav(slot, stick>0?'right':'left'); }
      else if(Math.abs(y) >= 0.6){ stick = 2; h.nav(slot, y>0?'down':'up'); }
    }

    if(pressed(B.LEFT)){ h.steer(slot, -1); h.nav(slot, 'left'); }
    if(pressed(B.RIGHT)){ h.steer(slot, 1); h.nav(slot, 'right'); }
    if(pressed(B.UP)) h.nav(slot, 'up');
    if(pressed(B.DOWN)) h.nav(slot, 'down');
    if(pressed(B.A)) h.confirm(slot);
    if(pressed(B.A) || pressed(B.X) || pressed(B.RB) || pressed(B.LB)) h.pulse(slot);
    if(pressed(B.B)) h.back(slot);
    if(pressed(B.START) || pressed(B.BACK)) h.pause(slot);

    prev.set(pad.index, { buttons: pad.buttons.map(b=>b.pressed), stick });
  });
}
