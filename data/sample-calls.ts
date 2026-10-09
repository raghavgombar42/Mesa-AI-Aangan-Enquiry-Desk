// The 20 phone enquiries from "Aangan Studio - Enquiry Transcripts, September 2026" (anonymised by the
// case). Phone numbers are TEST numbers (+91 90000 xxxxx) - the case redacted the real ones.
// `expected` is our hand reading of qualified.md for each call, used by `npm run samples` as a check.

export type SampleCall = {
  ref: string;
  startedAt: string; // IST
  durationSec: number | null;
  phone: string;
  expected: "book" | "book_note" | "close" | "nurture" | "escalate" | "incomplete";
  why: string;
  transcript: string;
};

const ph = (n: number) => `+91 90000 ${String(n).padStart(5, "0")}`;

export const SAMPLE_CALLS: SampleCall[] = [
  {
    ref: "T01", startedAt: "2026-09-02T10:23:00+05:30", durationSec: 252, phone: ph(101), expected: "book",
    why: "3BHK Kothrud, full redesign, March, owner + husband agreed",
    transcript: `Front Desk: Good morning, Aangan Studio.
Caller: Hi, I'm Priya. I got your number from a friend — Shruti Joshi. She had her flat done by you in Aundh.
Front Desk: Of course — thank you for calling. What are you looking to do?
Caller: We have a 3BHK in Kothrud — Dahanukar Colony. We bought it two years ago and it still looks like the builder flat. We want to redo the whole thing — kitchen, living room, both bedrooms.
Front Desk: That sounds like a complete redesign. How big is the apartment?
Caller: About 1,400 sq ft carpet.
Front Desk: And your timeline?
Caller: We'd like to be done by March. We're in no rush.
Front Desk: Perfect. Are you the owner?
Caller: Yes — myself and my husband. He knows we're calling and is happy to go ahead.
Front Desk: Lovely. Can I take your number and schedule a consultation?
Caller: Sure. (gives number)`,
  },
  {
    ref: "T02", startedAt: "2026-09-03T14:41:00+05:30", durationSec: 308, phone: ph(102), expected: "book",
    why: "2BHK Wakad full redesign, November move-in; 'I have a 2BHK' = owner; asked price twice",
    transcript: `Front Desk: Good afternoon, Aangan Studio.
Caller: Hi. I was looking at your work on Instagram. I have a 2BHK in Wakad — can you tell me roughly how much something like that would cost?
Front Desk: Our pricing depends on the materials and the scope — the best way to get a clear picture is a consultation with one of our designers, who can walk you through everything. What are you planning to do?
Caller: Full redesign — modular kitchen, wardrobes, living room, both bedrooms. About 950 sq ft.
Front Desk: Good scope. What's your timeline?
Caller: We move in November — so maybe starting design from October?
Front Desk: That works well. Shall I set up a consultation?
Caller: Yes, but can you give me a rough ballpark first? Even a range?
Front Desk: I genuinely can't — it varies quite a bit based on materials. Giving you a number without seeing the site would be misleading. The designer will go through all of that with you — the consultation is free and there's no obligation.
Caller: Okay, fair enough. Let's book it.`,
  },
  {
    ref: "T03", startedAt: "2026-09-03T16:15:00+05:30", durationSec: 160, phone: ph(103), expected: "close",
    why: "Site in Nashik - outside service area",
    transcript: `Front Desk: Good afternoon, Aangan Studio.
Caller: Hello, I saw your work on LinkedIn. My name is Suresh Patil. I'm in Nashik — would you be able to take on a project here? I want to redo my home office and study.
Front Desk: Thank you for calling. We only work in Pune and PCMC at the moment — we don't have the vendor network to take on projects outside Pune.
Caller: Not even for a smaller project?
Front Desk: Even for a smaller project, our execution depends on our contractors being on-site. I'm sorry we can't help.
Caller: Alright, understood. Thanks.`,
  },
  {
    ref: "T04", startedAt: "2026-09-04T11:07:00+05:30", durationSec: 202, phone: ph(104), expected: "close",
    why: "Advice only, no execution",
    transcript: `Front Desk: Good morning, Aangan Studio.
Caller: Hi — can someone come and give us some ideas for our living room? We're not planning to do the full thing right now. Just want suggestions on colours, furniture arrangement, what to change.
Front Desk: We're a full-service studio — our projects include design and execution together. We don't do advisory or consultation-only visits. If you're planning a full redesign with execution, we'd be a great fit.
Caller: Oh I see. No, we're just exploring for now. Maybe later.
Front Desk: Of course — feel free to call back when you're ready to go ahead with a full project.`,
  },
  {
    ref: "T05", startedAt: "2026-09-05T10:52:00+05:30", durationSec: 404, phone: ph(105), expected: "book",
    why: "4BHK Koregaon Park 2,400 sq ft, referred via Nikhil's friend; 'We have a 4BHK' = owner",
    transcript: `Front Desk: Good morning, Aangan Studio.
Caller: Hi, this is Aarti Mehta. Vikram Agarwal asked me to call — he's a close friend of Nikhil's.
Front Desk: Of course, thank you. What are you looking for?
Caller: We have a 4BHK in Koregaon Park — about 2,400 sq ft carpet. Complete redesign. New flooring, kitchen, all four bedrooms. We've already moved out temporarily.
Front Desk: That's a significant project. Do you have a timeline?
Caller: We want to move back in by February. About 4 months.
Front Desk: That should work well. Would you prefer a site visit for the consultation?
Caller: Yes please — Vikram said your team does that.
Front Desk: Absolutely. Can I check your availability for early next week?`,
  },
  {
    ref: "T06", startedAt: "2026-09-05T15:28:00+05:30", durationSec: 301, phone: ph(106), expected: "book",
    why: "800 sq ft office in Baner, bare shell, December, founder",
    transcript: `Front Desk: Good afternoon, Aangan Studio.
Caller: Hi, I'm calling about a commercial project. We're a startup — just got our first proper office space in Baner. About 800 sq ft. We need workstations for 20 people, a small cabin, a meeting room, and a break area.
Front Desk: We do commercial fitouts up to about 3,000 sq ft. What's the state of the space right now?
Caller: Bare shell — just columns and floor. Nothing else.
Front Desk: Full fitout from scratch. And the timeline?
Caller: We want to be operational by December. Our team is working from home currently.
Front Desk: December is doable. Are you the decision-maker for this?
Caller: Yes, I'm the founder.
Front Desk: Perfect. Let's set up a consultation.`,
  },
  {
    ref: "T07", startedAt: "2026-09-08T09:44:00+05:30", durationSec: 195, phone: ph(107), expected: "nurture",
    why: "Wants it done before Diwali (~3 weeks) - too soon; open to a November start",
    transcript: `Front Desk: Good morning, Aangan Studio.
Caller: Hello — I want to redo my living room and kitchen before Diwali. Can you take it up?
Front Desk: Diwali is about three weeks away. Our design phase alone takes 3–4 weeks, and execution follows. We couldn't do justice to a project in that time.
Caller: Even just the living room?
Front Desk: Even so — a room redesign with execution takes at least 8–10 weeks from start to finish. We wouldn't want to rush it.
Caller: What if I start after Diwali?
Front Desk: A November start would work well. Shall I note your details for that?
Caller: Let me think and call back.`,
  },
  {
    ref: "T08", startedAt: "2026-09-09T22:47:00+05:30", durationSec: null, phone: ph(108), expected: "incomplete",
    why: "Missed call at 10:47pm, no voicemail - the call the agent would now answer",
    transcript: `[Missed call at 10:47pm. No voicemail. Number associated with Nanded City area (Pune). No conversation took place.]`,
  },
  {
    ref: "T09", startedAt: "2026-09-10T11:32:00+05:30", durationSec: 352, phone: ph(109), expected: "escalate",
    why: "Existing client complaint - designer unresponsive for 5 days",
    transcript: `Front Desk: Good morning, Aangan Studio.
Caller: I need to speak to someone right now. My project has been going for three months and my designer hasn't replied in five days. This is not acceptable.
Front Desk: I'm very sorry. Can I take your name and project details?
Caller: Sheetal Deshpande. My designer is Aryan. Flat in Viman Nagar — 2BHK. I've sent three messages and called twice.
Front Desk: Sheetal, I'm getting this to our project team right now. Would you prefer to hold for two minutes, or should I have someone senior call you back within 15 minutes?
Caller: Callback. And I want it from Nikhil or a senior person — not just whoever picks up.
Front Desk: Noted. I'll make sure of that.`,
  },
  {
    ref: "T10", startedAt: "2026-09-11T14:04:00+05:30", durationSec: 220, phone: ph(110), expected: "close",
    why: "Volunteered ₹1–1.5L for kitchen + bedroom - clearly below scope",
    transcript: `Front Desk: Good afternoon, Aangan Studio.
Caller: Hi. I have a 1BHK in Kharadi — about 550 sq ft. I want to do the kitchen and one bedroom. My budget is 1 to 1.5 lakh maximum for everything. Is that possible with you?
Front Desk: I appreciate you sharing that. For a kitchen redesign and a bedroom with full execution — materials, furniture, and contractor work — 1 to 1.5 lakh would be significantly below what a project of that scope would cost with us.
Caller: Even for one bedroom?
Front Desk: Even for one room. I wouldn't want to bring you to a consultation if the numbers don't align. I'd suggest checking with local contractors who work at that price point.
Caller: Okay, thank you for being straight.`,
  },
  {
    ref: "T11", startedAt: "2026-09-12T10:18:00+05:30", durationSec: 382, phone: ph(111), expected: "book",
    why: "Rented 2BHK Baner, 3-year lease, no structural work, landlord OK",
    transcript: `Front Desk: Good morning, Aangan Studio.
Caller: Hi — I have a question. I'm in a rented apartment. Can you still take up a project?
Front Desk: It depends on the scope. What are you looking to do?
Caller: It's a 2BHK in Baner. I've been here a year, I have a 3-year lease, and the place is quite bare. I want to properly design the living room, bedroom, and kitchen — no structural changes, just design and fittings.
Front Desk: That's fine — we've done rented apartments before. For the kitchen we'd do a modular unit that can come out cleanly. The rest is largely flooring, lighting, and furniture — all reversible. Have you checked with your landlord?
Caller: Yes — they're fine with it as long as we don't break walls.
Front Desk: Perfect. No wall-breaking from us. Shall we set up a consultation?
Caller: Yes please.`,
  },
  {
    ref: "T12", startedAt: "2026-09-15T10:05:00+05:30", durationSec: 450, phone: ph(112), expected: "book",
    why: "5,500 sq ft villa Kalyani Nagar, March; 'possession was last month' = owner",
    transcript: `Front Desk: Good morning, Aangan Studio.
Caller: I'm calling about a villa project in Kalyani Nagar. My name is Anand Sharma. The property is about 5,500 sq ft — ground plus two floors. Full end-to-end design.
Front Desk: That's a significant project. Is this a new property or an existing home?
Caller: New construction. Possession was last month. Completely empty.
Front Desk: And your timeline?
Caller: March next year to move in. No rush.
Front Desk: Good time to start. Would you like our principal designer to come to site for the first consultation?
Caller: Yes — this week or next if possible.
Front Desk: Let me check the calendar and revert by end of day.`,
  },
  {
    ref: "T13", startedAt: "2026-09-16T12:19:00+05:30", durationSec: 368, phone: ph(113), expected: "book",
    why: "'My flat in Aundh' 3BHK 1,100 sq ft; pushed for a price range twice",
    transcript: `Front Desk: Good afternoon, Aangan Studio.
Caller: Hi — I want to redo my flat in Aundh. 3BHK, about 1,100 sq ft. What might it cost?
Front Desk: Our pricing depends on the materials and scope — the designers go through that at the consultation. What are you planning?
Caller: Kitchen, wardrobes in both bedrooms, living room. But seriously — can't you give me even a rough range? I just want to know if we're in the same ballpark.
Front Desk: I really can't give a number that would mean anything without seeing the site and the spec. The difference between a standard and a premium kitchen alone can be 3× the cost. The consultation is free — the designer will give you a proper number by the end of it.
Caller: Fine. Let's book then.
Front Desk: Perfect. What days work for you?`,
  },
  {
    ref: "T14", startedAt: "2026-09-17T11:41:00+05:30", durationSec: 295, phone: ph(114), expected: "book_note",
    why: "Son calling for parents' 3BHK Hadapsar - decision with parents, note it",
    transcript: `Front Desk: Good morning, Aangan Studio.
Caller: Hi — I wanted to inquire about an interior project for my parents. They have a 3BHK in Hadapsar — new possession. They want a proper design.
Front Desk: That sounds good. Will your parents be involved in the decision?
Caller: Yes — I'm doing the initial checking. They don't really use phones much. I'll tell them about the consultation and they'll decide.
Front Desk: Sure — just so we know: your parents would be at the consultation, right? Our designers like to understand the brief directly from the people who'll live in the space.
Caller: Yes, they would come. I'm just calling to see if it's worth pursuing.
Front Desk: Absolutely. Should I note your details and explain what the consultation involves?
Caller: Please. (gives number)`,
  },
  {
    ref: "T15", startedAt: "2026-09-18T15:12:00+05:30", durationSec: 344, phone: ph(115), expected: "book",
    why: "2BHK Undri 875 sq ft, possession in 6 weeks, owner + husband agreed",
    transcript: `Front Desk: Good afternoon, Aangan Studio.
Caller: Hi, I'm Smita. I'm getting possession of my flat in Undri in about six weeks. 2BHK, 875 sq ft. I want to start the design right away.
Front Desk: Six weeks is just enough lead time to get the design finalised before execution begins. What are you planning?
Caller: Full home — kitchen, wardrobes, living room. The full package.
Front Desk: Good scope. Are you the owner?
Caller: Yes — my husband and I. He said to go ahead and book the consultation.
Front Desk: Can we see the site in its current state, or do you need to wait for possession?
Caller: We can go now — the builder will let us in.
Front Desk: Even better. Let me get a designer's availability.`,
  },
  {
    ref: "T16", startedAt: "2026-09-19T10:38:00+05:30", durationSec: 318, phone: ph(116), expected: "book",
    why: "Repeat caller - Monday enquiry never followed up; 'my 3BHK in Viman Nagar'; frustrated",
    transcript: `Front Desk: Good afternoon, Aangan Studio.
Caller: Hi — I'd called on Monday about a project. Someone said they'd get back to me. It's been two days.
Front Desk: I'm very sorry. Can I get your name?
Caller: Girish Nair. I called Monday afternoon. I told someone about my 3BHK in Viman Nagar and gave my number.
Front Desk: I apologise — I don't see a note. Can you give me your details again? I'll book the consultation directly now so it doesn't slip again.
Caller: This is not a good sign if you forget before you even start.
Front Desk: You're absolutely right, and I'm sorry. Let me make this right now.`,
  },
  {
    ref: "T17a", startedAt: "2026-09-22T14:14:00+05:30", durationSec: 72, phone: ph(117), expected: "incomplete",
    why: "First call dropped after 1 min 12 sec",
    transcript: `Front Desk: Good afternoon, Aangan Studio.
Caller: Hi, I wanted to inquire about — (line drops)`,
  },
  {
    ref: "T17b", startedAt: "2026-09-22T14:16:00+05:30", durationSec: 270, phone: ph(117), expected: "book",
    why: "Same caller redials: 'We've been here two years' 3BHK Pimple Saudagar, by March",
    transcript: `Front Desk: Good afternoon, Aangan Studio.
Caller: Hi — I called just now and got cut off. I'm Ritu Kapoor from Pimple Saudagar. 3BHK, about 1,050 sq ft. We've been here two years but never properly did the interiors. We want to start now.
Front Desk: Thanks for calling back. Pimple Saudagar is in our service area. What are you looking to do?
Caller: Kitchen, wardrobes, living room. We moved in with builder furniture and it's very basic.
Front Desk: Standard full-home scope. Timeline?
Caller: Ideally done by March. Plenty of time.
Front Desk: Perfect. Let me book a consultation.`,
  },
  {
    ref: "T18", startedAt: "2026-09-23T11:55:00+05:30", durationSec: 182, phone: ph(118), expected: "close",
    why: "180 sq ft coworking pod - below commercial minimum",
    transcript: `Front Desk: Good morning, Aangan Studio.
Caller: Hi — I run a small coworking space. I have a 180 sq ft pod I want to make look really nice. Good lighting, a nice desk, some storage. Can you help?
Front Desk: Our commercial projects are typically 500 sq ft or more. A 180 sq ft pod is below our minimum scope.
Caller: Not even for a smaller fee?
Front Desk: It's not about the fee — it's that our design and execution team is set up for a certain scale. A 180 sq ft space isn't one we could do well at the quality we'd want to promise. I'd suggest a local designer who specialises in smaller commercial spaces.
Caller: Fair enough. Thanks.`,
  },
  {
    ref: "T19", startedAt: "2026-09-24T16:02:00+05:30", durationSec: 170, phone: ph(119), expected: "close",
    why: "Restaurant - out of scope",
    transcript: `Front Desk: Good afternoon, Aangan Studio.
Caller: Hi — I'm planning to open a restaurant in Koregaon Park. I've seen your work and I love it. Would you be able to design the interiors?
Front Desk: We appreciate you reaching out. Restaurant and hospitality interiors are outside our current scope — we focus on residential and office spaces. For a restaurant you'd need a studio that specialises in commercial hospitality, which has very different material and compliance requirements.
Caller: Do you know anyone you could refer?
Front Desk: I don't have a specific referral I could make confidently, but searching for hospitality interior designers in Pune would give you more relevant options.
Caller: Alright, thanks.`,
  },
  {
    ref: "T20", startedAt: "2026-09-25T09:15:00+05:30", durationSec: 284, phone: ph(120), expected: "book",
    why: "2BHK Magarpatta 900 sq ft, January start, owners both attending",
    transcript: `Front Desk: Good morning, Aangan Studio.
Caller: Good morning. I'm Pooja. I have a 2BHK in Magarpatta — Cybercity area. We've been wanting to properly design the interiors for a while. Kitchen, both bedrooms, living room. About 900 sq ft.
Front Desk: Good scope for us. How soon are you looking to start?
Caller: We're flexible — a January start for execution would be ideal.
Front Desk: That works well. Are you the owner?
Caller: Yes — my husband and I. We both want to be at the consultation.
Front Desk: Excellent. Can I book that now?
Caller: Please.`,
  },
];
