var _ = require('lodash')
var config = require('./config')
var Nudge = require('hapi-nudge')
var Hapi = require('hapi')
var Joi = require('joi')
var stripe = require('stripe')(config.stripeSecretKey)

var PATHNAME = '/'

var server = new Hapi.Server();

var validationPayload = (function() {
	var optionalStringParameters = [
		'description',
		'stripeBillingAddressCity',
		'stripeBillingAddressCountry',
		'stripeBillingAddressCountryCode',
		'stripeBillingAddressLine1',
		'stripeBillingAddressLine2',
		'stripeBillingName',
		'stripeBillingAddressState',
		'stripeBillingAddressZip',
		'stripeShippingAddressCity',
		'stripeShippingAddressCountry',
		'stripeShippingAddressCountryCode',
		'stripeShippingAddressLine1',
		'stripeShippingAddressLine2',
		'stripeShippingName',
		'stripeShippingAddressState',
		'stripeShippingAddressZip',
	];

	var validationPayload = {};
	optionalStringParameters.forEach(function(parameter) {
		validationPayload[parameter] = Joi.string();
	});

	validationPayload['amount'] = Joi.number().integer().greater(0).required();
	validationPayload['metadata'] = Joi.object();
	validationPayload['stripeToken'] = Joi.string().token().required();
	validationPayload['stripeTokenType'] = Joi.string().regex(/^card$/);
	validationPayload['stripeEmail'] = Joi.string().email().required();

	return validationPayload;
})();

module.exports = server;

server.app.PATHNAME = PATHNAME;

server.connection({
    port: config.port,
})

if (config.appName) {
    server.register({
        register: Nudge,
        options: {
            host: [
                config.appName,
                '.herokuapp.com',
            ].join(''),
            pathname: '/uptime',
            protocol: 'https',
        },
    }, function (err) { if (err) throw err })
}

server.route({
    config: {
        cors: {
            origin: config.corsOrigins,
        },
        validate: {
            payload: validationPayload,
        },
    },
    handler: function (request, reply) {
        var options = {
            amount: request.payload.amount,
            currency: config.currency,
            card: request.payload.stripeToken,
            metadata: _.extend({
                buyer_email: request.payload.stripeEmail,
            }, request.payload.metadata),
        }
        if (request.payload.description) {
            options.description = request.payload.description
        }
        stripe.charges.create(options, function (err) {
            if (err) return reply.redirect(config.errorRedirectUri)
            return reply.redirect(config.successRedirectUri)
        })
    },
    method: 'POST',
    path: PATHNAME,
})
