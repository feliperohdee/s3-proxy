const _ = require('lodash');
const got = require('got');

const regex = {
	svg: /<svg[^>]*>/g,
	nodesWithStyle: /<[^>]*style=".*"[^>]*>/g,
	nodeTag: /<\w+/g,
	styleFill: /fill:[^;"]*;?/g,
	styleStroke: /stroke:[^;"]*;?/g,
	fillAttribute: /fill="[^"]*"/g,
	strokeAttribute: /stroke="[^"]*"/g,
};

const replaceBy = {
	fill: '#d7006c', // '<%= attributes.style.background %>';
	stroke: '#d7006c' // '<%= attributes.style.background %>';
};

const insertAt = (string, start, newSubStr) => {
    return string.slice(0, start) + newSubStr + string.slice(start);
};

module.exports = url => got(url)
	.then(({
		body
	}) => {
		const svgNode = regex.svg.exec(body);

		if (svgNode) {
			const afterIndex = svgNode.index + svgNode[0].length;

			// insert defs
			body = insertAt(body, afterIndex, `\n<% if(defs && defs.length){ %><defs><%= defs.join('') %></defs><% } %>`);

			const nodesWithStyle = body.match(regex.nodesWithStyle);

			body = _.reduce(nodesWithStyle, (reduction, node) => {
				const [nodeTag] = node.match(regex.nodeTag);
				const hasFill = node.match(regex.styleFill);
				const hasStroke = node.match(regex.styleStroke);

				let newNode = node;

				if (hasFill && !_.includes(hasFill[0], 'none')) {
					newNode = newNode.replace(regex.styleFill, '');
					newNode = insertAt(newNode, nodeTag.length, ` fill="${replaceBy.fill}"`);
				}


				if (hasStroke && !_.includes(hasStroke[0], 'none')) {
					newNode = newNode.replace(regex.styleStroke, '');
					newNode = insertAt(newNode, nodeTag.length, ` stroke="${replaceBy.stroke}"`);
				}

				return reduction.replace(node, newNode);
			}, body);

			body = body.replace(regex.fillAttribute, `fill="${replaceBy.fill}"`);
			body = body.replace(regex.strokeAttribute, `stroke="${replaceBy.stroke}"`);

			return body;
		}
	});
