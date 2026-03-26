/**
 * Coach Knowledge Base
 * Distilled domain expertise injected into coach prompts at query time.
 * Select 1-2 domains per query using selectKnowledgeDomains().
 */

export type CoachDomain =
  | "training"
  | "nutrition"
  | "recovery"
  | "psychology"
  | "physiology"
  | "methodology"
  | "behaviour"
  | "hyrox";

// ── Domain Knowledge ─────────────────────────────────────────────────────────

const KNOWLEDGE: Record<CoachDomain, string> = {

  training: `
## Training Science: Evidence-Based Coaching Rules

**Volume & Intensity Distribution**
- 80/20 rule: ~80% easy (zone 2, conversational), ~20% hard (threshold/VO2). Most athletes overtrain the middle zone.
- Zone 2 running: pace where you can hold a full sentence. This builds the aerobic base that supports race performance.
- Increase total weekly volume by ≤10% per week to avoid overuse injury. For Hyrox/functional athletes, volume includes run km + station work.

**Periodisation**
- Base phase (4-8 weeks): high volume, low intensity. Build aerobic base, establish habits.
- Build phase (4-6 weeks): introduce threshold work, sport-specific sessions. Volume stays high.
- Peak phase (2-4 weeks): reduce volume 20-30%, increase race-pace specificity.
- Taper (1-2 weeks): cut volume 40-60%, maintain intensity, 2-3 key sessions only.
- Deload every 4th week: reduce volume by 20-30%, same or reduced intensity. Non-negotiable.

**Run Pacing**
- Easy pace: 60-75% max HR, able to hold conversation.
- Tempo/threshold: ~85-90% max HR, comfortably hard, can speak 2-3 words.
- Intervals (VO2): 90-95% max HR, can only grunt.
- For Hyrox: target race 1km splits ~10-15 seconds slower than 5km race pace.

**Strength for Endurance Athletes**
- 2x/week minimum. Posterior chain priority: deadlifts, Romanian deadlifts, Bulgarian split squats, glute bridges.
- Rep ranges: 3-6 reps for strength (not hypertrophy). Low reps, high load, minimal hypertrophy = better power-to-weight.
- Avoid leg-heavy strength on the day before key run sessions.

**Red Flags for Overtraining**
- Elevated resting HR >5 bpm above normal
- Performance plateau or regression over 2+ weeks
- Sleep disturbance, persistent fatigue, mood deterioration
- Loss of motivation for sessions previously enjoyed
- Response: 5-7 days easy, then rebuild.
`.trim(),

  nutrition: `
## Nutrition: Evidence-Based Guidance for Endurance Athletes

**Daily Macronutrients (per kg bodyweight)**
- Carbohydrate: 5-7 g/kg moderate training days; 7-10 g/kg high-volume days; 3-5 g/kg rest/recovery days.
- Protein: 1.6-2.0 g/kg/day for muscle maintenance and repair. Distribute across 4+ meals (~30-40g per meal).
- Fat: 1.0-1.5 g/kg/day. Prioritise omega-3s (salmon, walnuts, flaxseed) for anti-inflammatory effect.

**Peri-Training Nutrition**
- Pre-session (2-3 hours before): 1-2 g/kg carbs + moderate protein. Avoid high-fat/fibre close to training.
- Within 30 min before: light carbs (banana, gel, sports drink) if >60 min session.
- During (sessions >75 min): 30-60g carbs/hour. Gels, chews, sports drink.
- Post-session (within 60 min): 0.5-1.0 g/kg carbs + 20-40g protein for recovery.

**Race Day Fuelling (Hyrox ~50-70 min)**
- Pre-race meal 2-3 hours prior: 80-120g carbs, moderate protein, low fat/fibre.
- 30 min pre: 20-30g fast carbs if tolerated (gel or sports drink).
- During: not necessary for <70 min races; sip water at stations if available.

**Hydration**
- Daily baseline: 35-45ml/kg bodyweight.
- Training losses: drink to thirst. ~500-750ml per hour during exercise (adjust for heat).
- Signs of dehydration in training: dark urine, performance drop, headache, cramping.
- Sodium: include electrolytes (sports drink or salt) on sessions >90 min or in heat.

**Supplements with Evidence**
- Creatine monohydrate: 3-5g/day. Supports strength, recovery, and cognitive function.
- Caffeine: 3-6mg/kg bodyweight 45-60 min pre-race. Meaningful performance benefit.
- Beta-alanine: 3.2-6.4g/day. Buffers lactic acid, especially useful for Hyrox stations >1 min.
- Vitamin D: 2000-4000 IU/day if deficient (common in UK/northern climates).
- Magnesium glycinate: 300-400mg/day before bed — supports sleep and muscle recovery.
`.trim(),

  recovery: `
## Recovery & Readiness: What Actually Works

**Sleep — The #1 Recovery Tool**
- Target 7-9 hours. Athletes in heavy training need 8-9.
- Sleep debt accumulates and compounds performance loss. One poor night: -10-15% power output. Chronic restriction: severe.
- Practical sleep hygiene: consistent bedtime ±30 min, cool room (17-19°C), dark, no screens 60 min before.
- If an athlete is sleeping poorly: address sleep first before adding training load.

**Active Recovery**
- Active recovery beats complete rest for faster clearance of metabolic waste.
- Best active recovery: 20-30 min very easy cycling, swimming, or walking (HR <120 bpm). Not a "light run."
- Avoid strength or high-intensity on active recovery days — defeats the purpose.

**Soreness vs Injury**
- DOMS (delayed onset muscle soreness): peaks 24-48h post-training, diffuse, symmetric. Safe to train through with reduced intensity.
- Injury signals: sharp, localised pain; pain during movement (not after); pain that worsens with warm-up. These require rest and assessment.
- When in doubt: rest. One extra easy day costs nothing; training through a stress fracture costs months.

**Deload Weeks**
- Every 3-4 weeks, reduce volume 20-30% with same or slightly reduced intensity.
- Common mistake: athletes skip deload because they "feel fine." Adaptation happens during deload.
- Signs a deload is overdue: performance plateau, elevated resting HR, loss of motivation.

**HRV (Heart Rate Variability)**
- Higher HRV = better recovery status, more able to absorb training load.
- HRV <5% below personal baseline: take easy day.
- HRV <10% below baseline: full rest or active recovery only.
- Trend matters more than single readings. Consistently declining HRV = systemic fatigue signal.

**Return from Illness**
- Fever or below-neck symptoms (chest, lungs): complete rest until symptom-free, then 3-5 days easy before resuming normal training.
- Above-neck symptoms only: reduce intensity 50%; if feeling better after 15 min warm-up, proceed at reduced effort.
- Do not attempt to "make up" missed sessions after illness. Resume where you would have been, adjusted for fitness dip.
`.trim(),

  psychology: `
## Sports Psychology: Mental Performance Tools

**Race Anxiety**
- Pre-race nerves are physiologically identical to excitement. Reframe: "I'm excited" outperforms "I'm calm" — it maintains arousal without threat.
- Use the ABCDE model: Activating event → Belief → Consequence → Dispute the belief → new Effect.
- Normal pre-race thoughts to normalise: "What if I blow up?" "I'm not fit enough." Acknowledge them, don't fight them.

**Visualisation**
- Effective visualisation: first-person (through your eyes, not watching yourself), multi-sensory, process-focused.
- Script for Hyrox: visualise arriving at each station calm, executing technique correctly, transition runs under control.
- 5-10 min daily in race week. Not a replacement for sleep.

**Self-Talk**
- Replace evaluative self-talk ("I'm terrible at wall balls") with instructional self-talk ("drive through the hips").
- Cue words: simple, personal, action-oriented. Examples: "smooth," "drive," "relax," "strong."
- For hard moments in race: pre-set mantras rehearsed in training ("I've done harder," "one rep at a time").

**Building Race Confidence**
- Confidence comes from evidence. Reference specific past sessions where things went well.
- "Evidence inventory": before a race, list 5-10 specific training sessions that prove readiness.
- Avoid comparing to other athletes on race day. Focus only on the process.

**Managing Race-Day Execution**
- Process goals over outcome goals during the race. "Maintain form on station 7" beats "finish sub-55."
- If things go wrong mid-race: 10-second reset. Three deep breaths. Return to next process cue.
- Race debrief template: What went well? What would I change? What did I learn? (Not: "I failed because...")

**Motivation Troughs**
- Training motivation naturally dips at weeks 4-6 of a training block and in the final 2 weeks pre-race.
- Signs it's a trough (normal) vs burnout (needs action): temporary vs persistent, situational vs all aspects of life.
- For motivation troughs: change the stimulus (new route, different training partner, different music), not the goal.
`.trim(),

  physiology: `
## Exercise Physiology: How Fitness Actually Develops

**VO2max**
- VO2max is trainable by 10-25% with appropriate training. It's not a fixed ceiling.
- Best stimulus: VO2 intervals — 4-8 min at near-maximal pace, 1:1 work:rest, 3-5 sets/session, 1x/week.
- It takes 6-8 weeks of consistent training before VO2max improvements are measurable. Don't panic in early weeks.

**Lactate Threshold**
- Lactate threshold (LT) is the biggest determinant of race performance (more than VO2max for events >8 min).
- LT improves with tempo/threshold training: 20-40 min at comfortably hard pace (can speak 2-3 words), 1-2x/week.
- Elite endurance athletes have LT at 85-90% VO2max. Recreational athletes often at 65-75%. Big improvement potential.

**Aerobic Base**
- The aerobic base supports everything. Without it, intensity work builds on sand.
- Minimum base before adding intensity: 4 weeks of consistent zone 2 training.
- Every 1% increase in running economy = ~1% improvement in performance at same fitness.

**Muscle Fibre Types**
- Type I (slow-twitch): fatigue-resistant, aerobic, suited to endurance. Trainable.
- Type II (fast-twitch): powerful, fatigue quickly, suited to sprinting and heavy lifting.
- Most people have a mix. Strength training does not convert fibre types — it trains the ones you have.
- Hyrox demands both: type I for the running and sustained stations; type IIa for explosive sled work.

**Detraining Timeline**
- Cardiorespiratory fitness declines fastest: 10-15% VO2max loss in 2-3 weeks of complete rest.
- Muscular strength: more durable — 4-6 weeks before significant loss.
- Skill/technique: very durable.
- Implication: after illness/injury, cardiovascular fitness is the main rebuilding target.

**Adaptation Timeline**
- Neural adaptations (strength, coordination): 2-4 weeks.
- Muscular adaptations (hypertrophy, endurance): 6-8 weeks.
- Cardiovascular adaptations (VO2max, LT, capillary density): 8-16 weeks.
- The athlete must trust the process — they will feel unfit before they feel fit.
`.trim(),

  methodology: `
## Coaching Methodology: How Elite Coaches Think

**The Athlete Comes First**
- Always gather information before prescribing. "How are you feeling?" is a diagnostic question, not small talk.
- Great coaches ask more than they tell. 70/30 listening-to-talking ratio in early conversations.
- Read between the lines: "I'm fine" from a fatigued athlete may mean "I don't want to admit I'm struggling."

**Individualisation**
- Same training for every athlete is the mark of a mediocre coach. Every athlete has different recovery capacity, stress load, history, and psychology.
- Life stress (work, family, sleep) competes with training stress. High life stress = lower training load.
- Adjust prescriptions to the athlete's actual life, not the ideal theoretical plan.

**Progressive Overload**
- The fundamental stimulus for adaptation: stress → recovery → supercompensation → adaptation.
- Overload too fast: injury, overtraining. Too slow: no adaptation.
- Signals of appropriate overload: athlete finds sessions hard but manageable, performance improves over 2-4 week cycles.

**Decision Framework for Training Changes**
1. What does the athlete actually need right now? (Not what does the plan say)
2. What is the minimum effective dose to achieve the adaptation?
3. What is the risk of this session vs. the benefit?
4. What does the pattern of the last 2-4 weeks suggest?

**Communication Style**
- Direct but empathetic. "I want you to drop Thursday's session" beats "maybe consider possibly reducing..."
- When giving difficult feedback: specific → impact → suggestion. "You went out too fast on Tuesday (5km in first 2km), you paid for it in stations 6-8, let's pace more conservatively next time."
- Always end on what can be done, not what went wrong.

**Managing the Relationship**
- Coach authority comes from results and trust, not credentials. Earn trust with consistent, accurate guidance.
- Avoid dependency: the goal is to build athlete self-awareness and eventually self-coaching capability.
- Know when to challenge vs. when to support. Athletes in a trough need support first, challenge later.
`.trim(),

  behaviour: `
## Behaviour Change & Mentoring: The Science of Athlete Development

**Habit Architecture**
- Habits form when: cue (obvious trigger) → routine (the session) → reward (immediate, not future).
- Stack training onto existing habits: "After work coffee, I put on kit." Reduces decision fatigue.
- Make the minimum viable version non-negotiable: even on bad days, the short version happens.
- When life disrupts routine: don't skip entirely. A 20-min version > nothing. Maintains identity continuity.

**Motivation Architecture**
- Extrinsic motivation (race medals, coach approval) bridges to intrinsic motivation (love of running, identity as an athlete).
- Self-Determination Theory: autonomy, competence, relatedness. Coach must support all three.
  - Autonomy: give the athlete choices, not just mandates.
  - Competence: calibrate challenge to current ability. Hard enough to grow, not so hard they fail consistently.
  - Relatedness: community, coach relationship, shared purpose.
- Intrinsic motivation is the long game. Build it deliberately over months.

**Behaviour Change Communication**
- Autonomy-preserving language: "What do you think would work?" not "You need to..."
- Motivational interviewing: explore ambivalence, don't fight resistance. "What's making this hard right now?"
- Loss framing often outperforms gain framing in adherence contexts: "Missing this session means losing fitness you built" vs. "Do this session to get faster."
- When an athlete resists: don't double down. Get curious. Resistance is information.

**Handling Missed Sessions**
- Never shame. "What happened?" before "You should have..."
- Separate the person from the behaviour. "The plan was skipped" not "You failed."
- Reinforce recovery: "Getting back on track today is the most important thing."
- Identify the root cause: Was the session too hard? Poor scheduling? Life stress? Fix the system, not the person.

**Building Long-Term Consistency**
- Identity-based framing: "You're a runner" → missed run is anomalous. vs. "You run sometimes" → easy to slip.
- Track trends not sessions: 3 of 4 runs done is a winning week.
- Commitment devices: signed agreements, training partners, public commitments. These reduce the friction of deciding.

**Coaching Through Hard Periods**
- Injury: validate the frustration first. Then redirect to what CAN be trained.
- Race failure: debrief with curiosity, not blame. "What can we learn?" not "What went wrong?"
- Motivation trough: this is normal and temporary. Reduce load, change stimulus, hold the identity.
- Life events competing with training: explicitly give permission to deprioritise training temporarily. This prevents guilt-driven dropout.

**Long-Term Athlete Development**
- Phase 1 (months 1-3): build the habit. Outcome: showing up consistently.
- Phase 2 (months 4-12): build the identity. Outcome: "I am an athlete."
- Phase 3 (year 2+): build self-coaching capability. Outcome: athlete self-regulates and seeks input proactively.
`.trim(),

  hyrox: `
## Hyrox: Race-Specific Coaching Intelligence

**Race Format**
- 8 × 1km runs (runs between stations, not during) + 8 functional stations. Total ~9km movement + station work.
- Stations in order: SkiErg 1000m → Sled Push 50m → Sled Pull 50m → Burpee Broad Jump 80m → Rowing 1000m → Farmer's Carry 200m → Sandbag Lunges 100m → Wall Balls 100 reps.
- Typical finish times: Elite men <45min, competitive men 50-60min, competitive women 55-70min, recreational 65-90min.

**Station Standards & Coaching Points**
- SkiErg: Upper-body dominant error. Fix: drive with legs, pull with lats not arms. Target: 4:30-5:30 (competitive).
- Sled Push: Body angle is everything — lean forward aggressively, short fast steps. Don't upright push.
- Sled Pull: Harder than expected. Chest up, glutes drive it. Grip + posterior chain are limiters.
- Burpee Broad Jump: The mental killer. Consistent 1.5-1.7m jumps beat explosive-then-collapse. Keep breathing.
- Rowing: Sequence: legs → back → arms (not arms first). 60% legs, 30% back, 10% arms.
- Farmer's Carry: Grip is the limiter — train farmer walks 2x/week from week 1. Swap hands every 50-75m if needed.
- Sandbag Lunges: Carry bag at chest, not overhead. One lunge per 1-2 seconds. Knee tracks ankle — poor form = knee pain.
- Wall Balls: Sets of 10-15 are faster than chasing unbroken. Stand 0.3-0.5m from wall. Hips drive the throw.

**Pacing Strategy**
- Most common mistake: running 1km intervals too fast. Target 1km splits ~10-15 sec/km slower than 5km race pace.
- Stations 1-4: 85-90% effort (still relatively fresh). Station 4 (burpees) is the first psychological test.
- Stations 5-8: grinding. Expect significant slowdown. Form > speed here.
- 50m transition runs: easy jog (5:30-6:30/km), not sprint. These are recovery opportunities.
- Final 1km: if paced correctly in stations 6-8, you should have something left here.

**Training Priorities (12-week block)**
- Weeks 1-4: aerobic base (zone 2 running 3-4x/week), strength foundation (posterior chain priority).
- Weeks 5-10: sport-specific — SkiErg 2x/week, sled work 1-2x/week, rowing 2x/week, combo workouts (run → station → run).
- Weeks 11-12: full simulations at 85-90% effort. These reveal pacing errors before race day.
- Grip training: non-negotiable from week 1. Farmer walks, dead hangs, wrist curls.

**Hyrox Prediction Model**
- Add station benchmark times + 8-10 min for running (competitive) or 12-16 min (recreational) + 1-2 min transitions.
- SkiErg and Rowing split times matter most — they are the biggest time components.
- A full simulation (weeks 11-12) is the most accurate predictor.

**Race Week**
- Monday-Tuesday: easy runs only, light station rehearsal.
- Wednesday-Thursday: 2-3 light station reps at race effort (SkiErg 500m, Row 500m).
- Friday-Saturday: rest or very easy movement.
- Race day warm-up: 5 min jog, dynamic mobility, 2-3 light burpees, 10 wall balls, 3 SkiErg strokes.
`.trim(),

};

// ── Domain Routing ────────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<CoachDomain, string[]> = {
  hyrox: [
    "hyrox", "skierg", "ski erg", "sled push", "sled pull", "burpee broad jump", "wall ball",
    "farmer", "sandbag", "lunge", "station", "race simulation", "combo workout",
  ],
  recovery: [
    "tired", "fatigued", "exhausted", "sleep", "sore", "doms", "rest", "recovery", "deload",
    "hrv", "heart rate variability", "sick", "ill", "injury", "injured", "pain", "hurt",
    "overtrained", "burnout", "strain", "ache",
  ],
  nutrition: [
    "eat", "food", "fuel", "diet", "carbs", "carbohydrate", "protein", "calories", "calorie",
    "hydration", "water", "electrolyte", "weight", "nutrition", "supplement", "creatine",
    "caffeine", "race day food", "pre-race", "post-run",
  ],
  psychology: [
    "nervous", "anxious", "anxiety", "confident", "confidence", "mental", "motivation", "fear",
    "worried", "scared", "race day nerves", "visualise", "self-talk", "mindset", "doubt",
    "pressure", "stress",
  ],
  behaviour: [
    "habit", "consistent", "consistency", "missed", "skip", "skipped", "motivation", "accountability",
    "commit", "commitment", "struggling to", "can't stick", "keep missing", "always missing",
    "discipline", "routine", "identity",
  ],
  training: [
    "pace", "interval", "tempo", "easy run", "long run", "zone 2", "speed", "mileage", "volume",
    "sessions", "plan", "schedule", "periodise", "base", "build", "peak", "taper",
  ],
  physiology: [
    "vo2", "lactate", "threshold", "heart rate", "oxygen", "adaptation", "fitness", "detraining",
    "aerobic", "anaerobic", "muscle fibre", "capillary",
  ],
  methodology: [
    "coach", "approach", "how should", "training philosophy", "overload", "progressive",
    "too hard", "too easy", "calibrate",
  ],
};

/**
 * Select 1-2 knowledge domains most relevant to the athlete's message.
 * Always includes "hyrox" domain if the athlete's goal is Hyrox-related.
 */
export function selectKnowledgeDomains(
  message: string,
  isHyroxGoal: boolean,
): CoachDomain[] {
  const lower = message.toLowerCase();

  // Score each domain by keyword matches
  const scores: Partial<Record<CoachDomain, number>> = {};
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [CoachDomain, string[]][]) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > 0) scores[domain] = score;
  }

  // Sort by score descending, take top 2
  const ranked = (Object.entries(scores) as [CoachDomain, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([d]) => d)
    .slice(0, 2);

  // If Hyrox goal and hyrox domain not already selected, add it as context
  if (isHyroxGoal && !ranked.includes("hyrox") && ranked.length < 2) {
    ranked.push("hyrox");
  }

  // Default fallback
  if (ranked.length === 0) {
    return isHyroxGoal ? ["hyrox", "training"] : ["training", "methodology"];
  }

  return ranked;
}

/**
 * Returns the knowledge text to inject into a coach prompt.
 */
export function getCoachKnowledge(
  message: string,
  isHyroxGoal: boolean,
): string {
  const domains = selectKnowledgeDomains(message, isHyroxGoal);
  const sections = domains.map(d => KNOWLEDGE[d]);
  return sections.join("\n\n");
}
