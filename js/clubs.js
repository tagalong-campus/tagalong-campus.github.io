// The campus's official (verified) clubs. Only these can post official events.
// site: the club's website (placeholders for the demo). apply: the club normally asks for an application.
// members: example member count shown on the profile, before anyone in the room joins.
export const CLUBS = [
  { id: 'isa', name: 'International Students Association', short: 'ISA', cat: 'Culture', members: 214, blurb: 'Welcome events and trips for students from abroad' },
  { id: 'debating', name: 'Debating Club', short: 'Deb', cat: 'Study', members: 48, apply: true, blurb: 'Weekly debates, public speaking practice and inter-university competitions' },
  { id: 'rowing', name: 'Rowing Club', short: 'Row', cat: 'Sport', members: 62, apply: true, blurb: 'Early mornings on the river, beginners trained from scratch' },
  { id: 'running', name: 'Running Club', short: 'Run', cat: 'Sport', members: 95, blurb: 'Social runs for every pace, twice a week' },
  { id: 'football', name: 'Football Club', short: 'FC', cat: 'Sport', members: 120, blurb: 'Five-a-side and casual kickabouts' },
  { id: 'photo', name: 'Photography Club', short: 'Photo', cat: 'Culture', members: 57, blurb: 'Photo walks, workshops and an end-of-year show' },
  { id: 'lang', name: 'Language Exchange Society', short: 'Lang', cat: 'Languages', members: 133, blurb: 'Swap languages over coffee, all levels welcome' },
  { id: 'games', name: 'Board Games Society', short: 'Games', cat: 'Games', members: 71, blurb: 'Weekly game nights with a big shared collection' },
  { id: 'hiking', name: 'Hiking & Outdoors Club', short: 'Hike', cat: 'Walks', members: 88, blurb: 'Day hikes and weekend trips into the mountains' },
  { id: 'cooking', name: 'Cooking Club', short: 'Cook', cat: 'Food', members: 40, blurb: 'Cook and eat together, recipes from everywhere' },
  { id: 'music', name: 'Music Society', short: 'Music', cat: 'Culture', members: 66, blurb: 'Jam sessions, choir and open mic nights' },
  { id: 'business', name: 'Business Club', short: 'Biz', cat: 'Study', members: 102, blurb: 'Talks, networking and case competitions' },
  { id: 'oenology', name: 'Oenology Society', short: 'Wine', cat: 'Culture', members: 35, apply: true, blurb: 'Wine tastings with a sommelier, members only' }
].map(c => ({ ...c, site: `https://example.com/${c.id}` }));
export const clubInfo = name => CLUBS.find(c => c.name === name);
export const clubById = id => CLUBS.find(c => c.id === id);
