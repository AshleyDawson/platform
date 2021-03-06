/* global define */
define(function(require) {
    'use strict';

    var WorkflowModel,
        _ = require('underscore'),
        __ = require('orotranslation/js/translator'),
        BaseModel = require('oroui/js/app/models/base/model'),
        helper = require('oroworkflow/js/tools/workflow-helper'),
        StepCollection = require('./step-collection'),
        TransitionCollection = require('./transition-collection'),
        TransitionDefinitionCollection = require('./transition-definition-collection'),
        AttributeCollection = require('./attribute-collection'),
        StepModel = require('./step-model'),
        TransitionModel = require('./transition-model'),
        TransitionDefinitionModel = require('./transition-definition-model'),
        AttributeModel = require('./attribute-model'),
        EntityFieldsUtil = require('oroentity/js/entity-fields-util');

    WorkflowModel = BaseModel.extend({
        defaults: {
            name: '',
            label: '',
            entity: '',
            entity_attribute: 'entity',
            start_step: null,
            steps_display_ordered: false,
            steps: null,
            transitions: null,
            transition_definitions: null,
            attributes: null
        },

        entityFieldUtil: null,
        entityFieldsInitialized: false,

        positionIncrementPx: 35,

        initialize: function() {
            if (this.get('steps') === null) {
                this.set('steps', new StepCollection());
            }
            if (this.get('transitions') === null) {
                this.set('transitions', new TransitionCollection());
            }
            if (this.get('transition_definitions') === null) {
                this.set('transition_definitions', new TransitionDefinitionCollection());
            }
            if (this.get('attributes') === null) {
                this.set('attributes', new AttributeCollection());
            }

            _.each(this.get('steps').models, this.setWorkflow, this);
            _.each(this.get('transitions').models, this.setWorkflow, this);
            this.listenTo(this.get('steps'), 'add', this.setWorkflow);
            this.listenTo(this.get('transitions'), 'add', this.setWorkflow);
        },

        setWorkflow: function (item) {
            item.setWorkflow(this);
        },

        cloneTransitionDefinition: function(definition) {
            if (_.isString(definition)) {
                definition = this.getTransitionDefinitionByName(definition);
            }
            var cloned = this._getClonedItem(definition);

            var clonedModel = new TransitionDefinitionModel(cloned);
            this.get('transition_definitions').add(clonedModel);

            return clonedModel;
        },

        cloneTransition: function(transition, doNotAddToCollection) {
            if (_.isString(transition)) {
                transition = this.getTransitionByName(transition);
            }

            var cloned = this._getClonedItem(transition);
            if (transition.get('transition_definition')) {
                var transitionDefinition = this.cloneTransitionDefinition(transition.get('transition_definition'));
                cloned.transition_definition = transitionDefinition.get('name');
            }

            cloned.frontend_options = helper.deepClone(cloned.frontend_options);
            cloned.form_options = helper.deepClone(cloned.form_options);
            cloned.label = __('Copy of') + ' ' + cloned.label;
            if (doNotAddToCollection) {
                cloned._is_clone = true;
            }

            var clonedModel = new TransitionModel(cloned);
            clonedModel.setWorkflow(this);

            if (!doNotAddToCollection) {
                this.get('transitions').add(clonedModel);
            }

            return clonedModel;
        },

        cloneStep: function(step, doNotAddToCollection) {
            if (_.isString(step)) {
                step = this.getStepByName(step);
            }

            var cloned = this._getClonedItem(step);
            var clonedAllowedTransitions = [];
            _.each(step.getAllowedTransitions(this).models, function(transition) {
                var clonedTransition = this.cloneTransition(transition);
                clonedAllowedTransitions.push(clonedTransition.get('name'));
            }, this);
            cloned.allowed_transitions = clonedAllowedTransitions;
            cloned.label = __('Copy of') + ' ' + cloned.label;
            if (doNotAddToCollection) {
                cloned._is_clone = true;
            }
            if (cloned.position) {
                cloned.position = [
                    cloned.position[0] + this.positionIncrementPx,
                    cloned.position[1] + this.positionIncrementPx
                ]
            }

            var clonedModel = new StepModel(cloned);
            clonedModel.setWorkflow(this);

            if (!doNotAddToCollection) {
                this.get('steps').add(clonedModel);
            }

            return clonedModel;
        },

        _getClonedItem: function(item) {
            var cloned = _.clone(item.toJSON());
            cloned.name += '_clone_' + helper.getRandomId();

            return cloned;
        },

        setEntityFieldsData: function(fields) {
            this.entityFieldsInitialized = true;
            this.entityFieldUtil = new EntityFieldsUtil(this.get('entity'), fields);
            this.trigger('entityFieldsInitialize');
        },

        getFieldIdByPropertyPath: function(propertyPath) {
            var pathData = propertyPath.split('.');

            if (pathData.length > 1 && pathData[0] == this.get('entity_attribute')) {
                pathData.splice(0, 1);
                return this.entityFieldUtil.getPathByPropertyPath(pathData);
            } else {
                return null;
            }
        },

        getPropertyPathByFieldId: function(fieldId) {
            return this.get('entity_attribute') + '.' + this.entityFieldUtil.getPropertyPathByPath(fieldId);
        },

        getSystemEntities: function() {
            return this.systemEntities;
        },

        setSystemEntities: function(entities) {
            this.systemEntities = entities;
        },

        getOrAddAttributeByPropertyPath: function(propertyPath) {
            var attribute = _.first(this.get('attributes').where({'property_path': propertyPath}));
            if (!attribute) {
                attribute = new AttributeModel({
                    'name': propertyPath.replace(/\./g, '_'),
                    'property_path': propertyPath
                });
                this.get('attributes').add(attribute);
            }

            return attribute;
        },

        getAttributeByPropertyPath: function(propertyPath) {
            return _.first(this.get('attributes').where({'property_path': propertyPath}));
        },

        getAttributeByName: function(name) {
            return this._getByName('attributes', name);
        },

        getStepByName: function(name) {
            return this._getByName('steps', name);
        },

        getTransitionByName: function(name) {
            return this._getByName('transitions', name);
        },

        getTransitionDefinitionByName: function(name) {
            return this._getByName('transition_definitions', name);
        },

        getStartTransitions: function() {
            return this.get('transitions').where({'is_start': true});
        },

        _getByName: function(item, name) {
            return _.first(this.get(item).where({'name': name}));
        }
    });

    return WorkflowModel;
});
