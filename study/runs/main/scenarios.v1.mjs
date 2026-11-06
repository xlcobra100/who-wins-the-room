/**
 * Four study scenarios, one per decision domain (the user asked for a mix:
 * political, military, corporate, diplomatic). All places, firms and states are
 * fictional so the model's priors about real-world politics don't decide the vote.
 *
 * Every scenario is an open question, not a menu: each debater forms a plan from
 * their own archetype. The background is shared by everyone in the room and is
 * deliberately many-sided (money, people, risk, time, outside relations, precedent,
 * uncertainty) so a debater always has several angles to argue from, and no single
 * plan is obviously right.
 *
 * `room` frames the listeners neutrally (five voting members), `role` frames the
 * debaters. Neither carries any personality.
 */

export const SCENARIOS = [
  {
    id: 'dam',
    domain: 'political',
    title: 'The Brenna Dam',
    place: 'Valmora',
    question: 'What should Valmora do about the Brenna Dam before the spring melt?',
    room: 'This is the televised town-hall debate one week before Valmora votes on what to do about the Brenna Dam. Five residents have been chosen at random as the citizens\' panel.',
    role: 'a candidate for mayor of Valmora',
    listenerRole: 'one of the five residents on the citizens\' panel',
    background: [
      'Valmora is a river town of 41,000 people in a mountain valley. Nine kilometres upstream stands the Brenna Dam, an earth-fill dam built in 1961 that holds 180 million cubic metres of water.',
      'Last month\'s inspection found water seeping through the left side of the dam, 30% more than a year ago. The state engineers put the chance of failure at about 1 in 25 in any given spring if nothing is done, rising every year. If it fails with a full reservoir, 60% of the town floods within 90 minutes. 14,000 people live in that zone, including the hospital and two schools.',
      'A full rebuild costs €340 million and takes four years. During those years the reservoir must be held at 40%, which cuts the town\'s cheap hydro power. That power supplies 55% of Valmora\'s electricity, and the municipal utility\'s profits pay for the free buses and 9% of the town budget.',
      'Valmora\'s yearly budget is €210 million, and its debt is already at 78% of the legal ceiling.',
      'The national government offers €120 million in grants, but only if the town also bans new homes in the flood zone. That would freeze property values for about 5,800 households.',
      'A cheaper option: permanently lower the reservoir to 30% with a new spillway (€25 million, one year). Engineers estimate it cuts the risk of failure by about 80%, but hydro power falls by half and there would be water shortages in dry summers.',
      'Upstream, the town of Ostbrück (9,000 people) irrigates 3,200 hectares of orchards from the reservoir. Any lowering hurts them, and they have threatened to sue under a 1974 water-sharing agreement. Relations have been sour since a 2019 dispute over a landfill.',
      'The Kallberg paper mill, owned by the foreign Nordhalm Group, employs 2,300 people, the town\'s largest employer. It needs reservoir water, and Nordhalm has hinted it may move production if supply is cut for years.',
      'Moving the 3,100 residents of the low-lying Riverside district out of harm\'s way would cost €160 million and take three years. Riverside is older and poorer than the rest of town; 40% of its people are over 65. A relocation attempt in 2014 collapsed after protests.',
      'Two of the three insurers in town have announced they will stop flood cover in the zone next year. A siren early-warning system (€6 million) would give about 50 minutes\' warning; last year\'s evacuation drill took 70 minutes.',
      'The spring melt starts in about five months, and the snowpack is 20% above average.',
    ],
  },
  {
    id: 'salient',
    domain: 'military',
    title: 'The Halden Salient',
    place: 'Kaldmark',
    question: 'What should Kaldmark\'s forces do at Halden in the next 72 hours?',
    room: 'This is a closed session of Kaldmark\'s National Security Council. Two senior advisers present competing recommendations on Halden. The council\'s five voting members will then decide whose recommendation to adopt.',
    role: 'a senior adviser to Kaldmark\'s National Security Council',
    listenerRole: 'one of the five voting members of the National Security Council',
    background: [
      'Kaldmark, a country of 6 million, has been at war with its larger neighbour Vostra for 14 months, after Vostra invaded the eastern provinces. The front has mostly frozen, except at Halden.',
      'Halden is a river town that Kaldmark\'s 4th Brigade (about 3,800 troops) holds on the far bank of the Drava river. It sticks into Vostran lines like a thumb, and Vostran forces surround it on three sides.',
      'Halden\'s only supply route is one road and one bridge over the Drava. Vostran artillery has hit the road on 11 of the last 14 days. The brigade has artillery ammunition for about 9 days at the current rate of fire, and food for 20.',
      'Military intelligence says, with about 60% confidence, that Vostra has massed two divisions (around 15,000 troops) and will attack within 72 hours. Vostran drones now watch the bridge around the clock.',
      'About 6,000 civilians are still in Halden, many of them elderly and unwilling to leave. When Vostra took the town of Orsk last spring, 400 civilians disappeared and prisoners of war were later shown on Vostran television in poor condition.',
      'Halden has become a national symbol. The President has said publicly that "Halden will not fall", and the 4th Brigade includes many volunteers from the capital. A withdrawal would hand Vostra a propaganda victory in the week before allied governments vote on next year\'s aid package.',
      'Allies have promised 40 armoured vehicles and air-defence systems, but they arrive in three weeks at the earliest. Allied air support over Halden is not on offer; the allies have refused to fly over the front.',
      'A fighting withdrawal across the bridge at night would take an estimated 2-3 nights and could cost heavy casualties if Vostra spots it. Blowing the bridge afterwards would slow any Vostran advance toward the city of Mirov (pop. 210,000), 30 km behind the river.',
      'Kaldmark\'s strategic reserve has one mechanised brigade near Mirov. Committing it to break through to Halden would leave Mirov thinly defended for at least a month.',
      'Through the Red Cross, Vostra\'s local commander has offered a 48-hour local ceasefire to evacuate civilians, if Kaldmark pulls its heavy artillery back 10 km. Vostra broke a similar ceasefire at Orsk after 20 hours.',
      'The brigade has lost 22% of its strength since summer. Its commander reports morale "holding but brittle" and has asked for a decision, not a slogan.',
    ],
  },
  {
    id: 'board',
    domain: 'corporate',
    title: 'Brightwater Tools',
    place: 'Brightwater Tools',
    question: 'What strategy should Brightwater Tools adopt to survive the next two years?',
    room: 'This is an emergency meeting of the board of Brightwater Tools. Two senior executives present competing strategies. The board\'s five independent directors will then vote on whose strategy the company adopts.',
    role: 'a senior executive of Brightwater Tools presenting a strategy to the board',
    listenerRole: 'one of the five independent directors on the board',
    background: [
      'Brightwater Tools is a 92-year-old maker of power tools, with revenue of €1.4 billion and 6,200 employees. Its two big factories are in the small town of Lenhart (2,900 workers, the town\'s main employer) and in Corvo (1,600 workers).',
      'Cheap imports have cut Brightwater\'s market share from 19% to 13% in five years. Its operating margin has fallen from 11% to 2%. Debt is €900 million, and on current numbers the company will breach its loan covenants in about nine months. The banks would then be able to force a restructuring.',
      'HomeMart, the retail chain that sells 31% of Brightwater\'s tools, demands a 12% price cut from next year, or it will replace Brightwater with its own house brand.',
      'Option on the table: move most production to a contract manufacturer abroad. That would close the Corvo plant and shrink Lenhart by about half (around 3,000 jobs in total), cut costs by about €110 million a year, and cost €180 million in severance and closure costs.',
      'Option on the table: Crestline Capital, a private-equity fund, offers to buy the whole company at a 40% premium over today\'s share price. Crestline\'s last two industrial buyouts ended with factory closures and resale within four years.',
      'Option on the table: bet on Brightwater\'s new battery platform, "Volt-One". It needs €250 million more in development and launches in 18 months. In early tests professional builders rated it the best on the market, but the company has missed its last two launch dates.',
      'Option on the table: merge with its larger rival Halberg, which has better distribution in Asia. Halberg would control the combined company, and the merger needs competition approval, which takes 12-18 months.',
      'Brightwater\'s brand is built on "made in our own factories". In surveys, 58% of professional customers say that matters to them; only 12% say they would pay more than 5% extra for it.',
      'The founding Ahlgren family owns 38% of the shares and is split: the older generation opposes any sale, the younger one wants to sell. The workers\' pension fund has a €140 million deficit that the company must cover.',
      'The union contract runs out in eight months. The union has said it would accept a two-year pay freeze in exchange for a guarantee that both plants stay open. The mayor of Lenhart has offered €40 million in tax relief over 10 years if the Lenhart plant stays.',
      'The trade ministry is considering a 15% tariff on imported power tools; a decision is expected in six months but is far from certain.',
    ],
  },
  {
    id: 'river',
    domain: 'diplomatic',
    title: 'The Tessel River',
    place: 'Merova',
    question: 'What strategy should Merova pursue toward Saradan\'s Tessel dam?',
    room: 'This is a session of Merova\'s foreign-policy cabinet. Two senior envoys present competing strategies toward Saradan and its dam. The cabinet\'s five voting ministers will then decide whose strategy Merova follows.',
    role: 'a senior envoy advising Merova\'s foreign-policy cabinet',
    listenerRole: 'one of the five voting ministers in Merova\'s foreign-policy cabinet',
    background: [
      'Merova, a country of 24 million, lies downstream on the Tessel river and gets 70% of its fresh water from it. Upstream, its neighbour Saradan (31 million people) is building the Great Tessel Dam, a giant hydropower dam that is 80% complete.',
      'Saradan plans to fill the reservoir over three years, starting in 18 months. Merova\'s hydrologists estimate the river flow into Merova would drop 25% during filling, and 10% for good after that because of evaporation and Saradan\'s planned irrigation. Merova\'s farm sector employs 1 in 4 workers, and most farms depend on the river.',
      'A 1959 water treaty divided the river\'s water between Merova and a third downstream state; Saradan was never part of it and does not recognise it.',
      'The dam is financed by loans from Tarsun, a distant great power, which also has a contract to run Saradan\'s new port. Tarsun has offered to "help both sides find a solution", and it would also like a naval refuelling stop in Merova.',
      'Saradan\'s government faces an election in 10 months. The dam is hugely popular there: it would double the country\'s electricity supply, and today 40% of Saradanis have no reliable power.',
      'Saradan has offered a deal: it will fill the reservoir over seven years instead of three if Merova signs a 20-year contract to buy 2,000 megawatts of the dam\'s power at a fixed price, about 20% above what Merova pays now. That power would let Merova close two ageing coal plants.',
      'Merova is Saradan\'s largest food supplier, about 35% of Saradan\'s grain imports. Restricting that trade would hurt Saradan, but also Merova\'s own farmers, who would lose their best customer.',
      'The Regional Union, of which both countries are members, has offered to mediate. Its last mediation, over a fishing dispute, took four years and produced a deal both sides ignored.',
      'Merova could take the case to the International Court of Justice, but Saradan has not accepted the court\'s authority, so a ruling could not be enforced. A case would take three to five years.',
      'Merova\'s army is larger and better equipped than Saradan\'s. Some newspapers in Merova openly demand that the government "make it clear the dam will not be filled without our consent". Saradan has moved air-defence systems to the dam site.',
      'Climate scientists expect a 10-15% drop in rainfall over the river basin by 2050, whatever happens with the dam. Joint water management could, by their estimate, recover about half of the losses from filling through coordinated release schedules.',
    ],
  },
];

export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id);
