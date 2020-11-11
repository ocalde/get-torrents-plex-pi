const { isEmpty } = require('lodash');

module.exports.isValidURL = (url) => {
    try {
		new URL(url);
	} catch (err) {
		return false;
    }
    
    return true;
}