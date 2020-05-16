"use strict";

const population = {
	AL: 4903185, AK: 731545, AZ: 7278717, AR: 3017804, CA: 39512223, CO: 5758736, CT: 3565287, DE: 973764, DC: 705749, FL: 21477737, GA: 10617423,
	HI: 1415872, ID: 1787065, IL: 12671821, IN: 6732219, IA: 3155070, KS: 2913314, KY: 4467673, LA: 4648794, ME: 1344212, MD: 6045680, MA: 6892503,
	MI: 9986857, MN: 5639632, MS: 2976149, MO: 6137428, MT: 1068778, NE: 1934408, NV: 3080156, NH: 1359711, NJ: 8882190, NM: 2096829, NY: 19453561,
	NC: 10488084, ND: 762062, OH: 11689100, OK: 3956971, OR: 4217737, PA: 12801989, RI: 1059361, SC: 5148714, SD: 884659, TN: 6829174, TX: 28995881,
	UT: 3205958, VT: 623989, VA: 8535519, WA: 7614893, WV: 1792147, WI: 5822434, WY: 578759
}

function logScale(lo, hi) {
	lo = Math.log(lo);
	hi = Math.log(hi) - lo;
	return v => Math.round( 1000 * (Math.log(v) - lo) / hi );
}

const vScale = logScale(1, 0.0001), hScale = logScale(1, 100000);

async function dataset() {
	const rsp = await fetch('https://covidtracking.com/api/v1/states/daily.json');
	if(!rsp.ok) {
		console.error(await rsp.text());
		throw Error(`${rsp.status} ${rsp.statusText}`);
	}

	return rsp.json();
}

const highlight = (
	(fadeout, highlighted) => state => {
		if(state && fadeout) {
			clearTimeout(fadeout);
			fadeout = null;
		}

		if(highlighted!=state) {
			if(highlighted) {
				if(state) {
					fillPopup(state);
					highlightTrail(highlighted = state);
				} else if(!fadeout) {
					fadeout = setTimeout( () => {
						document.body.className = '';
						highlightTrail(fadeout = highlighted = null);
					}, 2000 );
				}
			} else {
				fillPopup(state);
				highlightTrail(highlighted = state);
				document.body.className = 'show';
			}
		}
	}
)();

async function loadMap() {
	const
		rsp = await fetch('https://upload.wikimedia.org/wikipedia/commons/2/2a/Blank_US_Map_With_Labels.svg'),
		text = await rsp.text();

	if(!rsp.ok) {
		console.error(text);
		throw Error(`${rsp.status} ${rsp.statusText}`);
	}

	const svg = (new DOMParser()).parseFromString(text, 'image/svg+xml');
	document.getElementById('map').innerHTML = svg.documentElement.innerHTML;
}

function loadCss() {
	const
		{stateColors} = window,
		style = document.createElement('style');

	style.type = 'text/css';
	style.innerHTML = Object.keys(stateColors).map(
		state => `
.pane>svg.data .${state} { stroke: #${stateColors[state]}; }
.pane>svg.map path#${state}, .pane>svg.map path#${state}- { fill: #${stateColors[state]} !important; }`
	).join('');

	document.head.appendChild(style);
}

loadCss();

let all;

dataset().then( ds => {
	all = ds.reduce(
		(all, {state, positive, negative, pending, hospitalized, deathIncrease, hospitalizedIncrease, positiveIncrease, totalTestResultsIncrease}) => {
			const
				{pos=[], hsp=[], raw=[]} = all[state] || {},
				tested = (positive||0) + (negative||0) + (pending||0);

			if(positive && population[state]) {
				const rate = hScale( 1000000 * tested / population[state] );

				raw.push({
					tested: totalTestResultsIncrease,
					dead: deathIncrease,
					positive: positiveIncrease,
					hospitalized: hospitalizedIncrease
				});

				if(rate>=0) {
					pos.unshift( [rate, vScale(positive/tested)] );
					if(hospitalized)
						hsp.unshift( [rate, vScale(hospitalized/tested)] );
				}

				all[state] = {pos, hsp, raw}
			}

			return all;
		}, {}
	);

	document.getElementById('data').innerHTML = Object.keys(all).map(
		state => `<g class="trail ${state}">` + markers(all[state].pos, 'pos-rate', state) + markers(all[state].hsp, 'hsp-rate', state) + '</g>'
	).join('');
} );

document.getElementById('data').addEventListener('mouseover', ({target}) => highlight(findParentWithClass(target, /\btrail\s*/)));
document.getElementById('data').addEventListener('mouseout', ({target}) => { if(findParentWithClass(target, /\btrail\s*/)) highlight(null); });

loadMap().then( () => {
	document.getElementById('map').addEventListener('click', ({target}) => highlight(mapStateId(target)));
	document.getElementById('map').addEventListener('mouseout', ({target: {tagName}}) => { if(tagName.toLowerCase()=='svg') highlight(null); });
} );

function markers(pts, mk, state) {
	return pts.length ?
			pts.map(([x,y]) => `<use href="#${mk}" x="${x}" y="${y}" />`).join('')
			+ `<polyline fill="none" points="${pts.map(xy => xy.join(',')).join(' ')}" />`
			+ text(pts[pts.length-1], state)
	: '';
}

function text([x, y], str) {
	return `<text x="${x}" y="${y}">${str}</text>`;
}

function findParentWithClass(elt, cls_regex) {
	while(elt && elt.tagName.toLowerCase() != 'svg')
		if(cls_regex.test(elt.className.baseVal))
			return elt.className.baseVal.replace(cls_regex, '').substr(0, 2);
		else
			elt = elt.parentNode;
	return null;
}

function fillPopup(state) {
	document.getElementById('stateLabel').innerHTML = state;
	document.getElementById('upper').innerHTML = barChart(all[state].raw, -300, 'tested', 'positive');
	document.getElementById('lower').innerHTML = barChart(all[state].raw, 100, 'hospitalized', 'dead');
}

function barChart(data, height, ...fields) {
	const
		maxValue = fields.reduce( (sofar, field) => Math.max(sofar, Math.max(...data.map(x => x[field]))), 0 ),
		width = Math.max(Math.min( Math.floor(400/data.length), 9 ) - 2, 2);

	return maxValue ? fields.map(
		field => data.map( ({[field]: value}, i) => {
			const h = height * value/maxValue;
			return `<rect class="${field}" x="${400 - (i+1)*width}" y="${Math.min(0, h)}" width="${Math.max(width-2,2)}" height="${Math.abs(h)}" />`;
		} ).join('')
	).join('') + fields.map(
		field => {
			let
				maxFieldValue = Math.max(...data.map(x => x[field])),
				h = height * maxFieldValue/maxValue;

			return maxFieldValue ? data.map( ({[field]: value}, i) => {
				if(value==maxFieldValue) {
					maxFieldValue = -1;
					return `<text x="${400 - i*width - (width+2)/2}" y="${h}">${value}</text>`;
				} else return '';
			} ).join('') : '';
		}
	).join('') : '';
}

function mapStateId({id}) {
	const [, state] = /^([A-Z]{2})-?$/.exec(id) || [];
	return state;
}

function highlightTrail(setState) {
	document.getElementById('data').querySelectorAll('g.trail').forEach(
		elt => {
			const [, state, hilite] = /^trail (..)( hilite)?$/.exec(elt.className.baseVal);
			if(hilite && setState!=state)
				elt.className.baseVal = `trail ${state}`;
			else if(!hilite && setState==state)
				elt.className.baseVal = `trail ${state} hilite`;
		}
	);
}
