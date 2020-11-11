const Ajv = require('ajv');

const ajv = new Ajv();

const schema = {
    type: 'object',
    properties: {
        torrentName: { type: 'string' },
        torrentURL: { type: 'string' },
        srtURL: { type: 'string' },
        mediaType: { type: 'string' },
        srtLanguage: { type: 'string', default: 'es', enum: [ 'es', 'en', 'fr', 'de' ] },

    },
    required: [ "torrentName" ],
    additionalProperties: false
};

module.exports = ajv.compile(schema);
