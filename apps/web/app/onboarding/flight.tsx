"use client";

import { forwardRef } from "react";

/**
 * The arrival's own layer. Rendered always, shown only once the flight starts,
 * so the tunnel has a canvas to draw into the moment Enter is pressed.
 */
export const Flight = forwardRef<HTMLDivElement, { onEnter: () => void }>(
  function Flight({ onEnter }, ref) {
    return (
      <div id="flight" ref={ref}>
        <canvas />
        <div className="arrive">
          <h2>Welcome</h2>
          <p />
          <button onClick={onEnter}>Enter</button>
        </div>
      </div>
    );
  },
);
