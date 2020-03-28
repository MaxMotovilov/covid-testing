"use strict";

const population = {
	AL: 4903185, AK: 731545, AZ: 7278717, AR: 3017804, CA: 39512223, CO: 5758736, CT: 3565287, DE: 973764, DC: 705749, FL: 21477737, GA: 10617423,
	HI: 1415872, ID: 1787065, IL: 12671821, IN: 6732219, IA: 3155070, KS: 2913314, KY: 4467673, LA: 4648794, ME: 1344212, MD: 6045680, MA: 6892503,
	MI: 9986857, MN: 5639632, MS: 2976149, MO: 6137428, MT: 1068778, NE: 1934408, NV: 3080156, NH: 1359711, NJ: 8882190, NM: 2096829, NY: 19453561,
	NC: 10488084, ND: 762062, OH: 11689100, OK: 3956971, OR: 4217737, PA: 12801989, RI: 1059361, SC: 5148714, SD: 884659, TN: 6829174, TX: 28995881,
	UT: 3205958, VT: 623989, VI: 8535519, WA: 7614893, WV: 1792147, WI: 5822434, WY: 578759
}

function logScale(lo, hi) {
	lo = Math.log(lo);
	hi = Math.log(hi) - lo;
	return v => Math.round( 1000 * (Math.log(v) - lo) / hi );
}

const vScale = logScale(1, 0.0001), hScale = logScale(1, 100000);

async function dataset() {
	const rsp = await fetch('https://covidtracking.com/api/states/daily');
	if(!rsp.ok) {
		console.error(await rsp.text());
		throw Error(`${rsp.status} ${rsp.statusText}`);
	}

	return (await rsp.json()).reduce(
		(all, {state, positive, negative, pending, hospitalized}) => {
			const
				{pos=[], hsp=[]} = all[state] || {},
				tested = (positive||0) + (negative||0) + (pending||0);

			if(positive && population[state]) {
				const rate = hScale( 1000000 * tested / population[state] );
				if(rate>=0) {
					pos.unshift( [rate, vScale(positive/tested)] );
					if(hospitalized)
						hsp.unshift( [rate, vScale(hospitalized/tested)] );
					all[state] = {pos, hsp}
				}
			}

			return all;
		}, {}
	);
}

dataset().then(
	all => {
		document.getElementById('data').innerHTML = Object.keys(all).map(
			state => `<g class="trail ${state}">` + markers(all[state].pos, 'pos-rate', state) + markers(all[state].hsp, 'hsp-rate', state) + '</g>'
		).join('');
	}
);

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

