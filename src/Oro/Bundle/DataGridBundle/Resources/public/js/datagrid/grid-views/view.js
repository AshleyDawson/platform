/*jslint nomen:true*/
/*global define*/
define([
    'backbone',
    'underscore',
    'orotranslation/js/translator',
    './collection',
    './model',
    'oroui/js/modal',
    'oroui/js/mediator'
], function (Backbone, _, __, GridViewsCollection, GridViewModel, Modal, mediator) {
    'use strict';
    var $, GridViewsView;
    $ = Backbone.$;

    /**
     * Datagrid views widget
     *
     * @export  orodatagrid/js/datagrid/grid-views/view
     * @class   orodatagrid.datagrid.GridViewsView
     * @extends Backbone.View
     */
    GridViewsView = Backbone.View.extend({
        className: 'btn-toolbar grid-views',

        /** @property */
        events: {
            "click .dropdown-menu a": "onChange",
            "click a.save": "onSave",
            "click a.save_as": "onSaveAs",
            "click a.share": "onShare",
            "click a.delete": "onDelete"
        },

        /** @property */
        template: _.template(
            '<div class="btn-group">' +
                '<button data-toggle="dropdown" class="btn dropdown-toggle <% if (disabled) { %>disabled<% } %>">' +
                    '<%=  current %>' + '<span class="caret"></span>' +
                '</button>' +
                '<ul class="dropdown-menu pull-right">' +
                    '<% _.each(choices, function (choice) { %>' +
                        '<li><a href="#" data-value="' + '<%= choice.value %>' + '">' + '<%= choice.label %>' + '</a></li>' +
                    '<% }); %>' +
                '</ul>' +
            '</div>' +
            '<div class="btn-group">' +
                '<% _.each(actions, function(action) { %>' +
                    '<% if (action.enabled) { %>' +
                        '<a href="#" class="btn <%= action.name %>"><%= action.label %></a>' +
                    '<% } %>' +
                '<% }); %>' +
            '</div>'
        ),

        /** @property */
        enabled: true,

        /** @property */
        choices: [],

        /** @property */
        permissions: {
            CREATE: false,
            EDIT: false,
            DELETE: false,
            SHARE: false,
            EDIT_SHARED: false
        },

        /** @property */
        viewsCollection: GridViewsCollection,

        /**
         * Initializer.
         *
         * @param {Object} options
         * @param {Backbone.Collection} options.collection
         * @param {Boolean} [options.enable]
         * @param {Array}   [options.choices]
         * @param {Array}   [options.views]
         */
        initialize: function (options) {
            options = options || {};

            if (!options.collection) {
                throw new TypeError("'collection' is required");
            }

            if (options.choices) {
                this.choices = _.union(this.choices, options.choices);
            }

            if (options.permissions) {
                this.permissions = _.extend(this.permissions, options.permissions);
            }

            this.collection = options.collection;
            this.enabled = options.enable != false;

            this.listenTo(this.collection, "updateState", this.render);
            this.listenTo(this.collection, "beforeFetch", this.render);

            options.views = options.views || [];
            _.each(options.views, function(view) {
                view.grid_name = options.collection.inputName;
            });

            this.viewsCollection = new this.viewsCollection(options.views);

            this.listenTo(this.viewsCollection, 'add', this._onModelAdd);
            this.listenTo(this.viewsCollection, 'remove', this._onModelRemove);

            GridViewsView.__super__.initialize.call(this, options);
        },

        /**
         * @inheritDoc
         */
        dispose: function () {
            if (this.disposed) {
                return;
            }
            this.viewsCollection.dispose();
            delete this.viewsCollection;
            GridViewsView.__super__.dispose.call(this);
        },

        /**
         * Disable view selector
         *
         * @return {*}
         */
        disable: function () {
            this.enabled = false;
            this.render();

            return this;
        },

        /**
         * Enable view selector
         *
         * @return {*}
         */
        enable: function () {
            this.enabled = true;
            this.render();

            return this;
        },

        /**
         * Select change event handler
         *
         * @param {Event} e
         */
        onChange: function (e) {
            e.preventDefault();
            var value = $(e.target).data('value');
            if (value !== this.collection.state.gridView) {
                this.changeView(value);
            }
        },

        /**
         * @param {Event} e
         */
        onSave: function(e) {
            var model = this._getCurrentViewModel();

            model.save({
                label: this._getCurrentViewLabel(),
                filters: this.collection.state.filters,
                sorters: this.collection.state.sorters
            }, {
                wait: true
            });

            model.once('sync', function() {
                mediator.execute('showFlashMessage', 'success', __('oro.datagrid.gridView.updated'));
            });
        },

        /**
         * @param {Event} e
         */
        onSaveAs: function(e) {
            var modal = new Modal({
                title: 'Filter configuration',
                content: '<label>name: <input name="name" type="text"></label>'
            });

            var self = this;
            modal.on('ok', function(e) {
                var model = new GridViewModel({
                    label: this.$('input[name=name]').val(),
                    type: 'private',
                    grid_name: self.collection.inputName,
                    filters: self.collection.state.filters,
                    sorters: self.collection.state.sorters
                });
                model.save(null, {
                    wait: true
                });
                model.once('sync', function(model) {
                    this.viewsCollection.add(model);
                }, self);
            });

            modal.open();
        },

        /**
         * @param {Event} e
         */
        onShare: function(e) {
            var model = this._getCurrentViewModel();

            model.save({
                type: 'public'
            }, {
                wait: true
            });

            model.once('sync', function() {
                mediator.execute('showFlashMessage', 'success', __('oro.datagrid.gridView.updated'));
            });
        },

        /**
         * @param {Event} e
         */
        onDelete: function(e) {
            var model = this._getCurrentViewModel();

            model.destroy({wait: true});
        },

        /**
         * @param {GridViewModel} model
         */
        _onModelAdd: function(model) {
            model.set('name', model.get('id'));
            model.unset('id');

            this.choices.push({
                label: model.get('label'),
                value: model.get('name')
            });
            this.collection.state.gridView = model.get('name');
            this.render();

            mediator.execute('showFlashMessage', 'success', __('oro.datagrid.gridView.created'));
        },

        /**
         * @param {GridViewModel} model
         */
        _onModelRemove: function(model) {
            this.choices = _.reject(this.choices, function (item) {
                return item.value == this.collection.state.gridView;
            }, this);
            this.collection.state.gridView = null;

            this.render();

            mediator.execute('showFlashMessage', 'success', __('oro.datagrid.gridView.deleted'));
        },

        /**
         * Updates collection
         *
         * @param gridView
         * @returns {*}
         */
        changeView: function (gridView) {
            var view, viewState;
            view = this.viewsCollection.get(gridView);

            if (view) {
                viewState = _.extend({}, this.collection.initialState, view.toGridState());
                this.collection.updateState(viewState);
                this.collection.fetch({reset: true});
            }

            return this;
        },

        render: function () {
            var html;
            this.$el.empty();

            if (this.choices.length > 0) {
                var currentView = this._getCurrentViewModel();
                html = this.template({
                    disabled: !this.enabled,
                    choices: this.choices,
                    current: this._getCurrentViewLabel(),
                    actions: [
                        {
                            label: __('oro.datagrid.action.save_grid_view'),
                            name: 'save',
                            enabled: typeof currentView !== 'undefined' && this.permissions.EDIT
                        },
                        {
                            label: __('oro.datagrid.action.save_grid_view_as'),
                            name: 'save_as',
                            enabled: this.permissions.CREATE
                        },
                        {
                            label: __('oro.datagrid.action.share_grid_view'),
                            name: 'share',
                            enabled: typeof currentView !== 'undefined' &&
                                    ((currentView.get('type') === 'private' && this.permissions.SHARE) ||
                                    (currentView.get('type' === 'public' && this.permissions.EDIT_SHARED)))
                        },
                        {
                            label: __('oro.datagrid.action.delete_grid_view'),
                            name: 'delete',
                            enabled: typeof currentView !== 'undefined' && this.permissions.DELETE
                        }
                    ]
                });

                this.$el.append(html);
            }

            return this;
        },

        /**
         * @private
         *
         * @returns {undefined|GridViewModel}
         */
        _getCurrentViewModel: function() {
            if (!this._hasActiveView()) {
                return;
            }

            return this.viewsCollection.findWhere({
                name: this._getCurrentView().value
            });
        },

        /**
         * @private
         *
         * @returns {boolean}
         */
        _hasActiveView: function() {
            return typeof this._getCurrentView() !== 'undefined';
        },

        /**
         * @private
         *
         * @returns {string}
         */
        _getCurrentViewLabel: function() {
            var currentView = this._getCurrentView();

            return typeof currentView === 'undefined' ? __('Please select view') : currentView.label;
        },

        /**
         * @private
         *
         * @returns {undefined|Object}
         */
        _getCurrentView: function() {
            var currentViews =  _.filter(this.choices, function (item) {
                return item.value == this.collection.state.gridView;
            }, this);

            return _.first(currentViews);
        }
    });

    return GridViewsView;
});
