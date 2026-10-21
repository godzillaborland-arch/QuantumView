import { QUESTIONS, TIERED_VRITTIS } from './data.js';

// Reader's Edition: a pre-order bonus, loaded only after it is unlocked, so free players never download it.
// Three more chapters on the same roads, tiers 4–6. Answer index 0 is always the correct one.
export const READERS_CHAPTERS = [
  {
    tier: 4, theme: 'city', title: 'The Missing Variable', place: 'Tokyo to Guindy',
    blurb: 'A lost passport, a DC generator joke and a transmission under a tree. Where the author\'s story begins, and why discipline alone was never the whole answer.',
    hazards: 'Notifications arrive in pairs and billboards shout from both sides of the road.',
    goal: 4, stages: [1,1,1,2,2], speed: 9.5, maxSpeed: 14.5, calm0: 0, calmGain: 0.06,
    vrittis: TIERED_VRITTIS[1], mix: { drifter:0.15, puddle:0, mirage:0 },
    boss: { name: 'THE OBSTINATE MIND', line: 'Restless, turbulent, powerful and obstinate: Gītā 6.34. Hold your lane.' }
  },
  {
    tier: 5, theme: 'monsoon', title: 'The Thought Barrier', place: 'Vibe coding to the APB Compass',
    blurb: 'Clearer intention, better outcome. Measure what a good session really is, and meet the barrier that more effort cannot break.',
    hazards: 'Worries drift between lanes. Puddles of self-deception splash the sensors.',
    goal: 4, stages: [2,2,2,3], speed: 11, maxSpeed: 16.5, calm0: 0.3, calmGain: 0.07,
    vrittis: TIERED_VRITTIS[2], mix: { drifter:0.35, puddle:0.3, mirage:0 },
    puddles: ['MORE EFFORT', 'TRY HARDER', 'LONGER SITS', 'JUST FASTER'],
    boss: { name: 'THE THOUGHT BARRIER', line: 'Like the sound barrier: not a power problem but a category problem. Going faster will not break it.' }
  },
  {
    tier: 6, theme: 'desert', title: 'The Promise Fulfilled', place: 'The two birds',
    blurb: 'Grace in the real world, the fallen yogi, and the bewildered bird that finally turns its head. Who\'s buying the Tesla?',
    hazards: 'Mirages of doubt appear without warning, and FSD cannot see them until they are close. Take the wheel when it matters.',
    goal: 4, stages: [2,2,3], speed: 12.5, maxSpeed: 18.5, calm0: 0.6, calmGain: 0.06,
    vrittis: TIERED_VRITTIS[3], mix: { drifter:0.25, puddle:0, mirage:0.45 },
    boss: { name: 'BEWILDERMENT', line: 'Powerless, grieving, bewildered: anīśayā śocati muhyamānaḥ. Turn your head and see the other bird.' }
  }
];

const R = [
  // Chapter 4 · The Missing Variable (book Ch.1–2, Ch.8)
  { t:4, q:"In Tokyo, what did the author lose the day before flying home?", a:["His passport","His wallet","His phone"], why:"It vanished from a shopping bag after a tax-free purchase. He reached the U.S. Embassy at 2:28 and made the flight." },
  { t:4, q:"The calm his friends noticed felt to the author like…", a:["Shock absorbers","A spare tire","Cruise control"], why:"“You don't feel them working. You just notice the ride's smoother than it used to be.”" },
  { t:4, q:"“If that is true, sir, am I a…?” asked the PhD candidate", a:["DC generator","Transformer","Radio antenna"], why:"A DC generator makes constant current with no wave: his joke about the De Broglie matter wave left the lecturer stumped." },
  { t:4, q:"Where did the transmission begin?", a:["Under a tree at Guindy","In a temple","At an ashram"], why:"Behind the engineering block, with his Royal Enfield parked nearby. No ashram, no rituals." },
  { t:4, q:"The author says the 1978 transmission was like…", a:["Downloading software","Learning a language","Building a muscle"], why:"“I hadn't earned this… It was simply transmitted, like downloading software I didn't even know I was receiving.”" },
  { t:4, q:"Where did the author first truly let FSD drive?", a:["The 405 in Los Angeles","Highway 50, Sacramento","A parking lot"], why:"Three hours of rush hour, and he arrived restored instead of drained." },
  { t:4, q:"“Tesla is driving me. I am not driving.” recalled…", a:["The Pool of Bethesda","The Good Samaritan","Noah's Ark"], why:"A friend with a dizziness condition called it “almost biblical. Like the lame being made to walk.”" },
  { t:4, q:"The missing variable clicked at a Supercharger on…", a:["Guru Pūrṇimā","Dīpāvalī","New Year's Day"], why:"July 2025: the day that honors the teacher who removes darkness." },
  { t:4, q:"His disciplined wife wasn't failing at meditation. She was…", a:["Building the car while driving it","Using the wrong app","Sitting too long"], why:"“I had been handed one already built, with lifetime charging.”" },
  { t:4, q:"Arjuna calls the mind restless, turbulent, powerful and…", a:["Obstinate","Gentle","Sleepy"], why:"Gītā 6.34: cañcala, pramāthi, balavat, dṛdham. As hard to restrain as the wind." },
  { t:4, q:"How long does Yuval Noah Harari meditate each day?", a:["Two hours","Ten minutes","Five hours"], why:"One hour morning, one evening, plus silent retreats of 30–60 days every year." },
  { t:4, q:"Harari found his intellectual training made meditation…", a:["Harder","Easier","Unnecessary"], why:"A historian builds stories; meditation asks you to observe without them." },
  { t:4, q:"Counting a month's salary shows the mind lacks…", a:["Perceived value, not capacity","The ability to focus","Enough sleep"], why:"The Jagadguru's experiment: the mind locks in when the stakes feel real." },

  // Chapter 5 · The Thought Barrier (book Ch.6–7, Ch.9–10)
  { t:5, q:"Who coined the term “vibe coding”?", a:["Andrej Karpathy","Elon Musk","Sam Altman"], why:"Tesla's former Senior Director of AI, in February 2025: “forget that the code even exists.”" },
  { t:5, q:"In the Meditation Monitor, any lever below 50% shows…", a:["Dhāraṇā","Dhyāna","Samādhi"], why:"Below 50% is the effort stage; all three above 50% is Dhyāna; all three at 100% is Samādhi." },
  { t:5, q:"Set all three levers to zero and the app says…", a:["“Dude, you are not meditating!”","“Namaste”","“Try again tomorrow”"], why:"Spiritual practice benefits from lightness and humor." },
  { t:5, q:"Vibe Coding Principle #1 is…", a:["Clearer intention, better outcome","Longer prompts, better code","More features, more value"], why:"Vague prompts get vague results: the same lesson every meditation teacher delivers." },
  { t:5, q:"On the APB scale, Dhyāna begins at…", a:["50%","10%","100%"], why:"0–49% is effortful Dhāraṇā. The crossing to 50% is qualitative, not quantitative." },
  { t:5, q:"The Sanskrit word Śraddhā means…", a:["Conviction the stakes are real","A breathing technique","A sacred text"], why:"The inner equivalent of having your salary on the table." },
  { t:5, q:"Even with FSD engaged, the author's hands were…", a:["Hovering over the wheel","Folded in his lap","On his phone"], why:"“The car was driving itself. I was performing driving.”" },
  { t:5, q:"How many clouds does The Cloud of Unknowing describe?", a:["Two","One","Seven"], why:"A cloud of forgetting below; a cloud of unknowing above." },
  { t:5, q:"The “thought barrier” is compared to…", a:["The sound barrier","A traffic jam","A locked door"], why:"Not a power problem but a category problem: it needs a different design." },
  { t:5, q:"True meditation is the mind drawn home, like…", a:["A bird coming to roost","Sheep driven into a pen","A car towed uphill"], why:"Pratyak Pravāhatā: the shepherd driving sheep is Dhāraṇā; the roosting bird is Dhyāna." },
  { t:5, q:"Absorption, Peace and Bliss are…", a:["Three inner signposts of a good session","Three yoga postures","Three breathing counts"], why:"The author's answer to the dinner-table question “How do you know it was a good session?”" },
  { t:5, q:"The APB framework comes from…", a:["The author's own practice","The Bhagavad Gītā","Mindfulness texts"], why:"“I started chiseling.” Years of practice and hundreds of conversations; then he stress-tested it with an AI." },
  { t:5, q:"Can you measure meditation?", a:["Yes, with the APB Compass","Don't be silly, it's not golf","Only with wires on your head"], why:"“Don't be silly” was the author's first reaction too. Then he built a compass that runs entirely from the inside." },

  // Chapter 6 · The Promise Fulfilled (book Ch.8–9, Ch.11–13, Conclusion)
  { t:6, q:"Parāñci-khāni: the senses are pierced…", a:["Outward","Inward","Upward"], why:"Kaṭha Upaniṣad 2.1.1: so we naturally look outward, not within." },
  { t:6, q:"To see the lantern's source, the officer must…", a:["Turn the lantern around","Polish the glass","Walk faster"], why:"Rāmakṛṣṇa's parable: the illuminator becomes the illuminated." },
  { t:6, q:"Who placed honey on baby D. K. Pattammal's tongue?", a:["Ramana Maharshi","Her music teacher","Amma"], why:"At Skandashram in Tiruvannamalai. Her father said that blessing was why she sang so well." },
  { t:6, q:"Salesforce's 1-1-1 pledge: 1% of equity, product and…", a:["Employee time","Office space","Profits"], why:"Pledged in 1999 after Marc Benioff met Amma, before there was anything to give." },
  { t:6, q:"Which sage guided Harihara and Bukka to found Vijayanagara?", a:["Vidyāraṇya","Ramana Maharshi","Vivekananda"], why:"One initiation installed the conviction that built an empire and sustained it for two centuries." },
  { t:6, q:"Oppenheimer's “Now I am become Death” is Gītā…", a:["11.32","2.47","6.34"], why:"Recited as the Trinity test lit the New Mexico sky." },
  { t:6, q:"Where did Jeffery Long find the Bhagavad Gītā?", a:["At a flea market","In a library","At an airport"], why:"In a church parking lot: “like finding the crystal from Krypton.”" },
  { t:6, q:"Arjuna feared the fallen yogi would perish like…", a:["A torn cloud","A broken boat","A burnt candle"], why:"Chinnābhram iva naśyati. Kṛṣṇa's answer: sincere practice carries forward; the battery does not reset at death." },
  { t:6, q:"In the Muṇḍaka Upaniṣad's tree, the still bird is…", a:["The Ātman, your true nature","The Guru","The mind"], why:"The eating bird is the Jīva. Sayujā: the two were never separate." },
  { t:6, q:"Anīśayā, Mitch Robbins's condition in City Slickers, means…", a:["Powerlessness","Anger","Laziness"], why:"an- (without) + īśa (lord): having lost the sense of authoring your own life." },
  { t:6, q:"Śocati, in Muṇḍaka Upaniṣad 3.1.2, means…", a:["Grieving","Sleeping","Searching"], why:"From the root śuc, to grieve. Present tense: continuous, not yet resolved. The soundtrack of the first bird's life." },
  { t:6, q:"Muhyamānaḥ, the bird's third condition, means…", a:["Bewildered","Powerless","Free from sorrow"], why:"From the root muh: someone still inside the confusion, not someone who once was confused and found clarity." },
  { t:6, q:"“Who's buying the Tesla?”", a:["The Guru","The seeker","The government"], why:"Śaṅkara's commentary on the two-birds verse." },
  { t:6, q:"The missing variable was not discipline. It was…", a:["Transmission","Talent","Luck"], why:"The Endowment Model: the car handed over fully built, the destination already set." }
];

QUESTIONS.push(...R);
