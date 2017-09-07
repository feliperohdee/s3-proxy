const _ = require('lodash');

const regex = {
	svg: /<svg[^>]*>/g,
	nodeTag: /<\w+/g,
	styleFill: /fill:[^;"]*;?/g,
	fillAttribute: /fill="[^"]*"/g,
	shapes: /<(rect|circle|ellipse|line|polyline|polygon|path|text)[^>]+>/g
};

const replacers = {
	fill: '<%= attributes.style.background %>'
};

const insertAt = (string, start, newSubStr) => {
	return string.slice(0, start) + newSubStr + string.slice(start);
};

const isNoneOrTransparent = value => {
	return _.includes(value, 'none') || _.includes(value, 'transparent');
};

module.exports = body => {
	const match = body.match(regex.svg);

	if (!match) {
		return body;
	}

	const afterIndex = body.indexOf(match[0]) + match[0].length;

	// insert defs
	body = insertAt(body, afterIndex, `\n<% if(defs && defs.length){ %><defs><%= defs.join('') %></defs><% } %>`);

	return _.reduce(body.match(regex.shapes), (reduction, shape) => {
		let newShape = shape;

		const [nodeTag] = shape.match(regex.nodeTag);

		// replace style fill by their respective attribute
		const fill = shape.match(regex.styleFill);

		if (fill && !isNoneOrTransparent(fill[0])) {
			newShape = newShape.replace(regex.styleFill, '');
			newShape = insertAt(newShape, nodeTag.length, ` ${replacers.fill}`);
		}

		// replace current fill attributes
		newShape = _.replace(newShape, regex.fillAttribute, (token, index, input) => {
			if (!isNoneOrTransparent(token)) {
				return replacers.fill;
			}

			return token;
		});

		// if no fill insert it
		if (!_.includes(newShape, 'fill=') && !_.includes(newShape, replacers.fill)) {
			newShape = insertAt(newShape, nodeTag.length, ` ${replacers.fill}`);
		}

		return reduction.replace(shape, newShape);
	}, body);
};
