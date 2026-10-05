// Editorial metadata and the small set of controls exposed by each experiment.
const preset = (labels) => ({ key: 'preset', label: 'Variation', labels, value: 0 });
const range = (key, label, min, max, step, value, unit = '') => ({ key, label, min, max, step, value, unit });
export const CHAPTERS = [
  { id: 'retro', name: 'Retro magic', label: 'Retro', color: '#ff965f', intro: 'Big worlds, tiny tricks. The ingenuity behind the pixels.', effects: ['fire', 'mode7', 'dither', 'raycast', 'plasma', 'voxelspace', 'tunnel'] },
  { id: 'nature', name: 'Rules of nature', label: 'Nature', color: '#a6ca91', intro: 'Simple local rules. Remarkably lifelike results.', effects: ['reaction', 'boids', 'terrain', 'life', 'dla', 'lsystem', 'phyllotaxis', 'slime', 'voronoi', 'langton'] },
  { id: 'flow', name: 'Go with the flow', label: 'Flow', color: '#7acbc5', intro: 'Follow a particle. Paint a current. Get a little lost.', effects: ['fluidgl', 'flow', 'fluid', 'curl', 'lbm'] },
  { id: 'physics', name: 'Beautiful systems', label: 'Physics', color: '#b7a4ee', intro: 'Motion, geometry, and a little mathematical mischief.', effects: ['attractor', 'rope', 'hash', 'spring', 'sdf', 'wfc', 'marching', 'mandelbrot'] },
];

export const CATALOG = {
  fire: {
    hint: 'Tap the fire to change its color', action: 'Next palette',
    summary: 'A handful of rules. A very convincing inferno.',
    challenge: 'Try an icy palette, then send the flames sideways with the wind.',
    steps: ['Heat the bottom row', 'Carry heat upward', 'Jitter and cool', 'Look up a color'],
    controls: [preset(['Classic', 'Ice', 'Toxic', 'Ember']), range('wind', 'Wind', -2, 2, 1, 0)],
  },
  boids: {
    hint: 'Move or drag to scatter the flock',
    summary: 'Nobody leads. Everybody follows three small rules.',
    challenge: 'Increase separation and draw a path through the flock. Can you split it in two?',
    steps: ['Give neighbors space', 'Match their heading', 'Steer toward the group'],
    controls: [range('count', 'Flock size', 30, 240, 10, 140), range('separation', 'Personal space', 8, 40, 1, 16)],
  },
  rope: {
    hint: 'Move or drag to swing the chain', summary: 'A chain that remembers where it was, and finds its way back.',
    challenge: 'Make a slow circle, then stop. Watch the motion travel down the chain.',
    steps: ['Remember two positions', 'Add gravity', 'Correct link lengths'],
  },
  flow: {
    hint: 'Tap to discover a new field', action: 'New field', reseed: true,
    summary: 'Invisible currents, made visible by wandering particles.',
    challenge: 'Turn up the detail to reveal smaller eddies. Save a field you love.',
    steps: ['Sample the noise', 'Turn its value into an angle', 'Move and leave a trail'],
    controls: [range('scale', 'Field detail', 0.001, 0.01, 0.0005, 0.0035)],
  },
  terrain: {
    hint: 'Tap to grow another mountain range', action: 'New terrain', reseed: true,
    summary: 'A mountain range, grown from four corners and a little noise.',
    challenge: 'Slow the simulation and watch the large shapes give way to fine detail.',
    steps: ['Average the corners', 'Add a little randomness', 'Subdivide and repeat'],
  },
  mode7: {
    hint: 'Watch the horizon pull the world into perspective',
    summary: 'One flat texture becomes a world you can fly through.',
    challenge: 'Follow a single tile toward the horizon. Notice how its height changes.',
    steps: ['Find depth for each row', 'Sample a flat texture', 'Draw toward the horizon'],
  },
  hash: {
    hint: 'Tap anywhere to give the balls a push', action: 'Push the center',
    summary: 'Hundreds of collisions, with a clever shortcut behind the scenes.',
    challenge: 'Push near a corner, then in the center. Compare the ripples of collisions.',
    steps: ['Put objects into grid cells', 'Find nearby candidates', 'Resolve their collisions'],
  },
  spring: {
    hint: 'Move or drag to compare the two followers',
    summary: 'The subtle difference between following a target and feeling alive.',
    challenge: 'Make a sharp turn. Which follower feels more natural?',
    steps: ['Choose a target', 'Compare interpolation and a spring', 'Watch how each arrives'],
  },
  sdf: {
    hint: 'Move or drag to attract a blob', summary: 'Liquid-looking shapes, described entirely by distance.',
    challenge: 'Pull a blob toward another until their edges become one.',
    steps: ['Measure distance to each shape', 'Blend the distance fields', 'Color the result'],
  },
  fluid: {
    hint: 'Move or drag to stir the fluid', summary: 'A tiny fluid simulation that you can stir with a fingertip.',
    challenge: 'Draw a slow spiral. Then push across it and watch the dye fold.',
    steps: ['Add velocity and dye', 'Trace the flow backward', 'Correct the pressure'],
  },
  curl: {
    hint: 'Tap to discover another current', action: 'New current', reseed: true,
    summary: 'Fluid-like motion, without running a fluid solver.',
    challenge: 'Pick one streamer and follow it through an eddy.',
    steps: ['Sample a potential field', 'Take its curl', 'Follow the resulting flow'],
  },
  life: {
    hint: 'Tap to seed a new tiny universe', action: 'New universe', reseed: true,
    summary: 'Three rules give rise to an entire pixel ecology.',
    challenge: 'Pause when you spot a blinker. Use Step to follow its next generations.',
    steps: ['Count living neighbors', 'Apply birth and survival rules', 'Advance one generation'],
  },
  fluidgl: {
    hint: 'Move or drag to paint with fluid', summary: 'Your fingertip is a brush. The canvas is a current.',
    challenge: 'Paint a loop, then cut through it. Save the moment the colors meet.',
    steps: ['Paint velocity and color', 'Solve the flow on the GPU', 'Advect the color through it'],
  },
  reaction: {
    hint: 'Tap to try another living pattern', action: 'Next pattern',
    summary: 'Two chemicals. Five different worlds of spots and stripes.',
    challenge: 'Compare Labyrinth and Mitosis. The same rules make very different worlds.',
    steps: ['Diffuse two chemicals', 'Let them react', 'Feed one and remove the other'],
    controls: [preset(['Labyrinth', 'Mitosis', 'Dense maze', 'Stripes', 'Replicators'])],
  },
  attractor: {
    hint: 'Tap to explore another strange attractor', action: 'Next attractor',
    summary: 'A point that never repeats its path, yet always belongs.',
    challenge: 'Switch from Lorenz to Aizawa. Let the shape reveal itself before saving it.',
    steps: ['Start from one point', 'Apply three equations', 'Trace its journey through space'],
    controls: [preset(['Lorenz', 'Aizawa', 'Halvorsen', 'Thomas'])],
  },
  dla: {
    hint: 'Tap to grow another colony', action: 'New colony', reseed: true,
    summary: 'Random wandering grows a delicate, branching crystal.',
    challenge: 'Watch an outer tip. Why does it tend to grow faster than a deep crevice?',
    steps: ['Release a random walker', 'Wander until it touches', 'Stick and release another'],
  },
  lsystem: {
    hint: 'Tap to plant another kind of tree', action: 'Next system',
    summary: 'A tiny grammar that grows into something botanical.',
    challenge: 'Switch from a plant to a snowflake. Both grow by rewriting a string.',
    steps: ['Begin with a short string', 'Rewrite its symbols', 'Draw the resulting instructions'],
    controls: [preset(['Fern', 'Bush', 'Vine', 'Snowflake'])],
  },
  phyllotaxis: {
    hint: 'Adjust the angle to discover new patterns', action: 'Compare angles',
    summary: 'The packing trick hiding in a sunflower.',
    challenge: 'Move the angle away from 137.5°. How quickly do spokes appear?',
    steps: ['Place the next seed farther out', 'Rotate by a fixed angle', 'Repeat a thousand times'],
    controls: [range('angle', 'Seed angle', 90, 180, 0.0001, 137.5077, '°')],
  },
  wfc: {
    hint: 'Tap to build another world', action: 'New world', reseed: true,
    summary: 'A world assembles as possibilities turn into decisions.',
    challenge: 'Pause, then Step. Watch one decision constrain its neighbors.',
    steps: ['Start with all possible tiles', 'Choose the least uncertain cell', 'Propagate the constraints'],
  },
  lbm: {
    hint: 'Tap to give the flow a kick', action: 'Kick the flow',
    summary: 'A rainbow reveals the vortices hiding behind an obstacle.',
    challenge: 'Follow one color downstream and look for alternating swirls.',
    steps: ['Store particles in nine directions', 'Collide and stream', 'Bounce off obstacles'],
  },
  slime: {
    hint: 'Move or drag to guide the colony · tap to reseed', action: 'New colony', reseed: true,
    summary: 'A colony that finds its way by following its own traces.',
    challenge: 'Hold near an empty corner and see the colony reach toward you.',
    steps: ['Sense nearby trails', 'Turn toward the strongest', 'Walk, deposit, and diffuse'],
  },
  marching: {
    hint: 'Move or drag to pull the contour lines',
    summary: 'A smooth landscape emerges from sixteen tiny cases.',
    challenge: 'Pull two islands together. Watch the contour change topology.',
    steps: ['Sample four corners', 'Choose one of sixteen cases', 'Connect the contour crossings'],
  },
  voronoi: {
    hint: 'Tap anywhere to add a seed', action: 'Add a central seed',
    summary: 'Give each point its nearest neighbor. Let the cells settle.',
    challenge: 'Add several seeds close together and watch them find breathing room.',
    steps: ['Assign each point to its nearest seed', 'Find each cell’s center', 'Move the seed toward it'],
  },
  dither: {
    hint: 'Move or drag to add light · tap to change levels', action: 'Next palette depth',
    summary: 'A beautiful image made by carefully distributing its mistakes.',
    challenge: 'Compare two levels with sixteen. Where does the lost detail go?',
    steps: ['Round a pixel to a palette color', 'Pass the error to its neighbors', 'Continue across the image'],
    controls: [preset(['2 levels', '4 levels', '8 levels', '16 levels'])],
  },
  raycast: {
    hint: 'Focus the canvas and use WASD or arrows to drive', action: 'Next map',
    summary: 'A flat map becomes a world you can walk through.',
    challenge: 'Take the wheel. Compare a nearby wall with one across the room.',
    steps: ['Cast a ray for each column', 'Find the first wall', 'Turn its distance into height'],
    controls: [preset(['Labyrinth', 'Pillars'])],
  },
  mandelbrot: {
    hint: 'Move over the left half · tap to hold a Julia set', action: 'Hold / release Julia',
    summary: 'One point in one fractal is a whole world in another.',
    challenge: 'Move near the edge of the Mandelbrot set and watch the Julia set transform.',
    steps: ['Choose a complex starting value', 'Repeat z² + c', 'Color how quickly it escapes'],
    controls: [range('real', 'Real part', -2.2, 0.7, 0.001, -0.78), range('imaginary', 'Imaginary part', -1.1, 1.1, 0.001, 0.18)],
  },
  plasma: {
    hint: 'Tap to switch the color palette', action: 'Next palette',
    summary: 'A few overlapping waves become a shifting sea of color.',
    challenge: 'Switch to Mono to see the underlying waves without the color.',
    steps: ['Combine several sine waves', 'Shift their phases', 'Look up a color'],
    controls: [preset(['Amber', 'Orchid', 'Spectrum', 'Mono'])],
  },
  voxelspace: {
    hint: 'Move or drag sideways to look around',
    summary: 'Rolling terrain, painted one screen column at a time.',
    challenge: 'Pan toward a ridge and watch it hide the terrain behind it.',
    steps: ['Walk into a heightmap', 'Project each height', 'Keep the nearest visible surface'],
  },
  langton: {
    hint: 'Tap to start the ant’s journey again', action: 'Restart the ant', reseed: true,
    summary: 'A tiny ant takes a very surprising turn from chaos to order.',
    challenge: 'Let it wander until a highway appears. Pause and inspect the repeating pattern.',
    steps: ['Read the cell’s color', 'Turn left or right', 'Flip the color and step'],
  },
  tunnel: {
    hint: 'Move or drag to drift · tap to change color', action: 'Next palette',
    summary: 'An endless descent, made from a single flat texture.',
    challenge: 'Drift off-center, then try a different palette. The geometry stays the same.',
    steps: ['Find angle and inverse distance', 'Scroll through a texture', 'Look up the color'],
    controls: [preset(['Amber', 'Teal', 'Orchid', 'Mono'])],
  },
};

export const SPEED = range('speed', 'Speed', 0.25, 2, 0.25, 1, '×');
