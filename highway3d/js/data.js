// Content from The Self-Driving Mind. Answer index 0 is always the correct one.
export const QUESTIONS = [
  { t:1, q:"What is the biggest obstacle to meditation?", a:["The restless mind","Not having enough time","Not sitting perfectly"], why:"Arjuna's complaint in the Gītā: the mind is harder to control than the wind. This book opens with exactly that question." },
  { t:1, q:"When Full Self-Driving is engaged, the car…", a:["Drives itself","Needs constant steering","Only cruises straight"], why:"The locus of control shifts from the hand gripping the wheel to the car's own intelligence. The passenger stays alert, but is not driving." },
  { t:1, q:"With Lifetime Charging, a Tesla never suffers from…", a:["Range anxiety","Flat tires","Traffic jams"], why:"The energy question is settled. You will never be stranded for lack of power, and the journey is always possible." },
  { t:1, q:"Which measures a meditation session best?", a:["Quality of attention","Minutes on the timer","How still you sat"], why:"Depth of presence is measured by the quality of attention, not the quantity of minutes." },
  { t:1, q:"In the book's analogy, Full Self-Driving maps to…", a:["Dhyāna","Prāṇāyāma","Willpower"], why:"FSD maps to Dhyāna: deep, effortless contemplative absorption. The shift from manual to autonomous." },
  { t:1, q:"Lifetime Charging maps to…", a:["Kṛpā, Grace","Daily discipline","Self-effort"], why:"Kṛpā is the infinite spiritual energy that becomes available to the seeker through the Guru's lineage." },
  { t:1, q:"“I sat for forty-five minutes” is which false measure?", a:["Clock time","Posture perfection","Visual fireworks"], why:"False Measure #1. Duration is not depth. Five real minutes outweigh forty-five performed ones." },
  { t:1, q:"App meditation and classical Dhyāna differ like…", a:["A campfire and a supernova","Tea and coffee","A bicycle and a bus"], why:"Both involve fire. One warms your hands on a cold night. The other can reshape galaxies." },
  { t:1, q:"In 1978 at Guindy, the author's nickname was…", a:["Quantum","Feynman","Professor"], why:"“Quantum,” for his obsession with quantum mechanics and pure logic. The skeptical rationalist." },
  { t:2, q:"Patañjali's image for the unbroken flow of Dhyāna is…", a:["Oil poured between vessels","Water splashing in a cup","A candle flickering"], why:"Taila-dhārāvat: oil pouring from one vessel to another. Continuous, smooth, uninterrupted." },
  { t:2, q:"In the Tesla metaphor, the realized Guru is the…", a:["Systems programmer","Passenger","Roadside mechanic"], why:"The Acharya who has traversed the path implants the destination in the seeker's navigation system." },
  { t:2, q:"Which discipline is “the clean sensor”?", a:["Satya, truthfulness","Longer sittings","Perfect posture"], why:"Every act of inner dishonesty is mud on the lens. Self-deception corrupts the data the mind feeds the system." },
  { t:2, q:"With the destination set, the seeker's one remaining job is…", a:["Vehicle maintenance","Gripping the wheel","Watching the battery"], why:"The Yamas and Niyamas are the maintenance schedule: keep the vehicle in the condition that lets the autopilot run." },
  { t:2, q:"The APB Compass reads three signals:", a:["Absorption, Peace, Bliss","Attention, Posture, Breath","Awareness, Patience, Balance"], why:"Absorption, Peace (Śānti) and Bliss (Ānanda). At the apex they fuse into a single state." },
  { t:2, q:"According to the book, what clouds the system first?", a:["Self-deception","Lying to others","Skipping practice"], why:"We lie to others occasionally. We lie to ourselves constantly. Every story we tell ourselves about our motives is mud on the lens." },
  { t:2, q:"Who demolished Quantum's rational arguments at Guindy?", a:["A young PhD candidate","A visiting swami","His physics lecturer"], why:"A research scholar in crisp white with vibhūti on his forehead, who knew more quantum mechanics than the lecturers." },
  { t:2, q:"For that young PhD candidate, Samādhi was…", a:["The default state","A rare achievement","A distant goal"], why:"He had to struggle to come out of meditation to do ordinary chores. A Siddha Purusha at twenty-three or twenty-four." },
  { t:3, q:"Step one of the Śaṅkara Algorithm, Pūrvapakṣa, is to…", a:["State the common view fairly","Show the glitch","Land the deeper truth"], why:"Pūrvapakṣa, Uttarapakṣa, Siddhānta. Start by stating the prior view so charitably the opponent feels heard." },
  { t:3, q:"Neti Neti means…", a:["Not this, not this","I am that","Here and now"], why:"The ancient method of debugging by exclusion. Strip away everything that is not the answer until the truth remains." },
  { t:3, q:"Scrolling a feed with no destination in mind is which chitta-bhūmi?", a:["Kṣipta, restless","Mūḍha, dull","Ekāgram, one-pointed"], why:"Kṣipta is the mind under the sway of the senses: a pinball bouncing between inputs, with no stable center." },
  { t:3, q:"The first chitta-bhūmi where higher spiritual experience becomes possible:", a:["Ekāgram, one-pointed","Vikṣipta, preoccupied","Kṣipta, restless"], why:"Bhojadeva is unambiguous: ekāgram is the first state where higher experience opens. Years of preparation are the entry cost." },
  { t:3, q:"Where do most educated, productive people spend their waking hours?", a:["Vikṣipta, preoccupied","Niruddha, closed","Ekāgram, one-pointed"], why:"Vikṣipta works a problem with some continuity. It permits concentration, but it is quite different from true meditation." },
  { t:3, q:"Satya comes from the root sat, which means…", a:["Being, what truly exists","Silence","Strength"], why:"Sat is being, reality, that which truly exists. Satya is alignment between what is seen, thought, spoken and done." },
  { t:3, q:"Śānti comes from the root śam, which means…", a:["To settle, to cease","To shine","To strive"], why:"Peace is not the absence of noise. It is a mind that has settled on its own rather than been forced into submission." }
];

export const ENDLESS_PROMPTS = [
  "The fuel is infinite.", "The destination is already set.", "Let the road carry you.",
  "Stillness in motion.", "No effort remains.", "Observe the passing thoughts."
];
// Reflection portals (after Dhyāna) offer three of these; every lane is right.
export const REFLECTIONS = ["Breathe", "Let go", "Observe", "Rest", "Trust", "Be still", "Notice", "Allow", "Return", "Soften"];

export const TIERED_VRITTIS = {
  1: ["PING", "NEW EMAIL", "50% OFF", "SCROLL", "LOUD NOISE"],
  2: ["REGRET", "DEADLINE", "WORRY", "RANGE ANXIETY", "CRAVING"],
  3: ["EGO", "WHAT IF?", "DOUBT", "SPIRITUAL PRIDE", "VISUAL FIREWORKS"]
};

export const BILLBOARDS = ["BUY NOW","BREAKING","3 NEW ALERTS","LIMITED TIME","YOU'RE LATE","TRENDING","SALE","UNREAD 99+"];

export const GOAL = 10;

export const MODES = {
  discovery: { name:'Discovery', read:1.4, slow:0.68 },
  challenge: { name:'Challenge', read:1.0, slow:0.78 },
  mastery:   { name:'Mastery',   read:0.8, slow:0.82 }
};

// Logical track space shared by rules and renderer: lanes are -1, 0, 1; z is distance ahead of the camera.
export const ZMAX = 60, CARZ = 1;

export const FONTS = {
  mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
  display: '"Marcellus", Georgia, serif'
};
