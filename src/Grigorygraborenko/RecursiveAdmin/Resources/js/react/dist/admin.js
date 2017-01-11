(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _item_table = require('./item_table.jsx');

var _input_modal = require('./input_modal.jsx');

////////////////////////////////////////////////////////////////////////////////
// Input Modal
////////////////////////////////////////////////////////////////////////////////
var AdminContainer = React.createClass({
    displayName: 'AdminContainer',

    getInitialState: function getInitialState() {

        var default_width = 120;

        var columns = {};
        for (var name in g_InitialData.entities) {
            var entity = g_InitialData.entities[name];

            var column = {};
            var column_index = 0;

            var associations = [];
            for (var type in entity.associations) {
                associations = associations.concat(entity.associations[type]);
            }

            var column_list = [];
            entity.actions.forEach(function (action) {
                column_list.push({ index: column_index++, width: default_width, name: "_action_" + action.label, priority: action.priority, sub_priority: 2 });
            });
            associations.forEach(function (assoc) {
                column_list.push({ index: column_index++, width: default_width, name: assoc.fieldName, priority: assoc.priority, sub_priority: 1 });
            });
            for (var fieldName in entity.fields) {
                column_list.push({ index: column_index++, width: default_width, name: fieldName, priority: entity.fields[fieldName].priority, sub_priority: 0 });
            }
            column_list.sort(function (a, b) {
                if (b.priority === a.priority) {
                    return b.sub_priority - a.sub_priority;
                }
                return b.priority - a.priority;
            });
            column_list.forEach(function (col_entry, index) {
                column[col_entry.name] = { index: index, width: default_width };
            });

            var saved = this.getSavedColumns(name);
            for (var saved_field in saved) {
                column[saved_field] = saved[saved_field];
            }

            columns[name] = column;
        }

        return { modal: null, columns: columns };
    },
    componentDidMount: function componentDidMount() {
        var this_ref = this;
        $(".global-action-button").click(function () {
            this_ref.showGlobalActionModal($(this).data("name"));
        });
    },
    showGlobalActionModal: function showGlobalActionModal(action_name) {

        var action = g_InitialData.global_actions[action_name];

        var this_ref = this;
        this.showModal(action.description, action.input, function (input, callback) {

            if (action.direct_call === true) {

                input._name = action.name;
                input._index = action.index;

                var params = [];
                for (var key in input) {
                    params.push(encodeURIComponent(key) + '=' + encodeURIComponent(input[key]));
                }
                var url = g_InitialData.global_route;
                if (params.length > 0) {
                    url += "?" + params.join('&');
                }
                window.location = url;
                callback(true);
            } else {

                var form_data = new FormData();
                for (var field_name in input) {
                    //if(action.input[field_name].type !== "file") {
                    if (!(input[field_name] instanceof File)) {
                        continue;
                    }
                    form_data.append(field_name, input[field_name]);
                }
                form_data.append("input", JSON.stringify(input));
                form_data.append("name", action.name);
                form_data.append("index", action.index);

                $.ajax({
                    type: "POST",
                    url: g_InitialData.global_route
                    // ,dataType: "json"
                    , processData: false,
                    contentType: false,
                    data: form_data
                }).done(function (data) {
                    g_InitialData.global_actions = data.global_actions;

                    // todo: make the global actions stuff it's own react component
                    for (var global_name in data.global_actions) {
                        var global = data.global_actions[global_name];
                        $('button[data-name="' + global_name + '"]').html(global.label).removeClass().addClass(global.classes); //.removeClass("hidden");
                    }
                    if (this_ref.props.entity !== undefined) {
                        $(".global-action-specific").addClass("hidden").filter("." + this_ref.props.entity.replace(/\\/g, "-")).removeClass("hidden");
                    }

                    if (data.result.file !== undefined) {

                        var contents = data.result.file.contents.replace(/ /g, "%20").replace(/\n/g, "%0A");
                        var $link = $('<a download="' + data.result.file.name + '" href="data:application/octet-stream,' + contents + '">CSV Octet</a>');
                        $("body").append($link);
                        $link[0].click();
                    }

                    if (data.result.refresh === true) {
                        callback(true);
                        this_ref.showGlobalActionModal(action_name);
                    } else {
                        callback(true, data.result.report !== undefined ? data.result.report : null);
                    }
                }).error(function (data) {
                    callback(false, data.responseJSON === undefined ? "Unknown Error" : data.responseJSON.result);
                });
            }
        });
    },
    getSavedColumns: function getSavedColumns(entity_name) {
        var saved = localStorage.getItem("_columns_" + entity_name);
        if (saved === null) {
            return {};
        }
        try {
            return JSON.parse(saved);
        } catch (e) {
            return {};
        }
    },
    moveHeader: function moveHeader(entity_name, field_name, diff) {

        var min_width = 60;

        var new_columns = $.extend({}, this.state.columns);
        var new_entity_cols = $.extend({}, new_columns[entity_name]);

        var old = new_entity_cols[field_name];
        var new_width = old.width + diff;

        var saved = this.getSavedColumns(entity_name);

        if (new_width < min_width && old.index > 0) {
            var prev_field_name = Object.keys(new_entity_cols).find(function (name) {
                return new_entity_cols[name].index === old.index - 1;
            });
            if (prev_field_name === undefined) {
                return;
            }
            var prev_width = new_entity_cols[prev_field_name].width;
            new_entity_cols[field_name] = { index: old.index - 1, width: prev_width + new_width };
            new_entity_cols[prev_field_name] = { index: old.index, width: prev_width };

            saved[prev_field_name] = new_entity_cols[prev_field_name];
        } else {
            new_entity_cols[field_name] = { index: old.index, width: Math.max(min_width, new_width) };
        }
        saved[field_name] = new_entity_cols[field_name];
        new_columns[entity_name] = new_entity_cols;

        localStorage.setItem("_columns_" + entity_name, JSON.stringify(saved));

        this.setState({ columns: new_columns });
    },
    showModal: function showModal(heading, input, callback) {
        // callback should take an input hash and it's own callback(success, err_msg)
        this.setState({ modal: { heading: heading, input: input, callback: callback } });
    },
    hideModal: function hideModal() {
        this.setState({ modal: null });
    },
    render: function render() {

        if (this.props.entity !== undefined) {
            var table = React.createElement(_item_table.ItemTable, { entity: this.props.entity, showModal: this.showModal, columns: this.state.columns, moveHeader: this.moveHeader });
        } else {
            var table = React.createElement(
                'span',
                null,
                'No item selected'
            );
        }

        return React.createElement(
            'div',
            { className: "wrapper" },
            React.createElement(_input_modal.InputModal, { input: this.state.modal, hideModal: this.hideModal, columns: this.state.columns, moveHeader: this.moveHeader }),
            React.createElement(
                'div',
                { className: "wrapper content", style: { top: this.props.offset } },
                table
            )
        );
    }
});

////////////////////////////////////////////////////////////////////////////////
// INIT
////////////////////////////////////////////////////////////////////////////////
gf_RenderData = function gf_RenderData(entity) {

    if (entity !== undefined) {
        $(".global-action-specific").addClass("hidden").filter("." + entity.replace(/\\/g, "-")).removeClass("hidden");
    }
    var el = document.getElementById('main-admin-container');
    var header_height = $(".header").height();
    ReactDOM.render(React.createElement(AdminContainer, { entity: entity, offset: header_height }), el);
};

if (g_Outstanding !== null) {
    gf_RenderData(g_Outstanding);
    g_Outstanding = null;
} else if (window.location.hash !== "") {
    var name = window.location.hash.replace("#", "");
    gf_RenderData(g_InitialData.entity_names[name]);
} else {
    gf_RenderData();
}

},{"./input_modal.jsx":2,"./item_table.jsx":4}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.InputModal = undefined;

var _item_table = require('./item_table.jsx');

////////////////////////////////////////////////////////////////////////////////
// Chart Component
////////////////////////////////////////////////////////////////////////////////
var ChartContainer = React.createClass({
    displayName: 'ChartContainer',

    render: function render() {
        return React.createElement('div', null);
    },
    componentDidMount: function componentDidMount() {
        this.node = ReactDOM.findDOMNode(this);

        this.canvas = $('<canvas id="modal-canvas" width="80%" height="400"></canvas>');
        $(this.node).append(this.canvas);

        //var is_time = (this.props.field.type === "date") || (this.props.field.type === "datetime");

        var labels = [];
        var data = [];
        this.props.data.forEach(function (point) {
            labels.push(point.value_of);
            data.push(parseInt(point.number_of));
        });

        this.chart = new Chart(this.canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '# of items grouped by ' + this.props.field.label,
                    data: data,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255,99,132,1)',
                    borderWidth: 1
                }]
            },
            options: {
                maintainAspectRatio: false
                //,responsive: false
                , scales: {
                    yAxes: [{ ticks: { beginAtZero: true } }]
                }
            }
        });

        this.renderContent(this.props);
    },
    componentWillReceiveProps: function componentWillReceiveProps(new_props) {
        this.renderContent(new_props);
    },
    renderContent: function renderContent(props) {

        React.Component(React.createElement(
            'div',
            null,
            props.children
        ), this.node);
    },
    componentWillUnmount: function componentWillUnmount() {
        ReactDOM.unmountComponentAtNode(this.node);
        //this.chart.destroy();
    }
});

////////////////////////////////////////////////////////////////////////////////
// FieldInput Component
////////////////////////////////////////////////////////////////////////////////
/**
 * Created by Grigory on 14-Dec-16.
 */

var FieldInput = React.createClass({
    displayName: 'FieldInput',

    //getInitialState: function() {
    //    var state = {};
    //    // this.getDefaultFieldState(state, this.props.input);
    //    return { input: state };
    //}
    componentDidMount: function componentDidMount() {
        var state = {};
        if (this.props.state !== null) {
            state = $.extend({}, this.props.state);
        }
        this.getDefaultFieldState(state, this.props.input);
        this.props.onChange(state);
    }
    // ,componentWillReceiveProps: function(props) {
    //     if(props.input === null) {
    //         return;
    //     }
    //
    //     var state = {};
    //     this.getDefaultFieldState(state, props.input);
    //     this.setState({ input: state });
    // }
    , getDefaultFieldState: function getDefaultFieldState(state, input, existing) {
        for (var fieldName in input) {
            if (state[fieldName] !== undefined) {
                continue;
            }
            var field = input[fieldName];
            if (field.type === "select") {

                var selected_val = field.choices[0];
                if (field.default !== undefined) {
                    field.choices.forEach(function (choice) {
                        if (choice.value === field.default) {
                            selected_val = choice;
                        }
                    });
                }
                if (selected_val !== undefined) {
                    state[fieldName] = selected_val.value;
                    if (selected_val.input) {
                        this.getDefaultFieldState(state, selected_val.input);
                    }
                } else {
                    state[fieldName] = "";
                }
            } else if (field.default !== undefined) {
                if (field.type === "date" || field.type === "datetime") {
                    if (field.default === "") {
                        state[fieldName] = null;
                    } else if (field.default.date !== undefined) {
                        state[fieldName] = Math.floor(new Date(field.default.date + " UTC").getTime() * 0.001);
                    } else {
                        state[fieldName] = new Date(field.default).getTime() * 0.001;
                    }
                } else {
                    state[fieldName] = field.default;
                }
            } else if (field.type === "boolean") {
                state[fieldName] = false;
            } else if (field.type === "entity") {
                state[fieldName] = {};
            } else if (field.type === "multientity") {
                state[fieldName] = [];
            } else if (field.type === "date" || field.type === "datetime") {
                state[fieldName] = null;
            } else if (field.type === "array") {
                state[fieldName] = [];
            } else if (field.type !== "info") {
                // goes last
                state[fieldName] = "";
            }
        }
    },
    onChange: function onChange(field_name, field, sub_field, evnt) {

        var change = {};
        if (field.type === "boolean") {
            change[field_name] = evnt.target.value === true || evnt.target.value === "true";
        } else if (field.type === "select") {
            change[field_name] = evnt.target.value;
            field.choices.forEach(function (choice) {
                if (choice.value === evnt.target.value && choice.input) {
                    this.getDefaultFieldState(change, choice.input);
                }
            }, this);
        } else if (field.type === "entity") {
            change[field_name] = evnt;
        } else if (field.type === "date" || field.type === "datetime") {

            var current = this.props.state[field_name];
            var day_seconds = 86400;
            if (sub_field === "date") {
                if (evnt.target.value === "") {
                    change[field_name] = null;
                } else {
                    var new_date_time = Math.floor(new Date(evnt.target.value).getTime() * 0.001);
                    change[field_name] = new_date_time + current % day_seconds;
                }
            } else if (sub_field === "hour") {
                var days = Math.floor(current / day_seconds);
                change[field_name] = days * day_seconds + parseInt(evnt.target.value) * 3600;
            } else if (sub_field === "minute") {
                var hours = Math.floor(current / 3600);
                change[field_name] = hours * 3600 + parseInt(evnt.target.value) * 60;
            } else if (sub_field === "second") {
                var minutes = Math.floor(current / 60);
                change[field_name] = minutes * 60 + parseInt(evnt.target.value);
            }
        } else if (field.type === "multientity") {
            // var new_selects = this.state.input[field_name].filter(function(select) {
            var new_selects = this.props.state[field_name].filter(function (select) {

                var selected = true;
                for (var propname in select) {
                    if (select[propname] !== evnt[propname]) {
                        selected = false;
                        break;
                    }
                }
                return !selected;
            });
            change[field_name] = new_selects;
            // if(this.state.input[field_name].length === new_selects.length) {
            if (this.props.state[field_name].length === new_selects.length) {
                change[field_name].push(evnt);
            }
        } else {
            change[field_name] = evnt.target.value;
        }
        // var input = $.extend({}, this.state.input, change);
        // this.setState({ input: input });
        var input = $.extend({}, this.props.state, change);
        this.props.onChange(input);
    },
    handleCopyClipboard: function handleCopyClipboard(text, fieldname, field) {
        var element = document.createElement('div');
        element.textContent = text;
        document.body.appendChild(element);

        if (document.selection) {
            var range = document.body.createTextRange();
            range.moveToElementText(element);
            range.select();
        } else if (window.getSelection) {
            var range = document.createRange();
            range.selectNode(element);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
        }

        document.execCommand('copy');
        element.remove();

        this.onChange(fieldname, field, null, { target: { value: "Copied." } });
    },
    handleFileChange: function handleFileChange(field_name, field, evnt) {
        var file = evnt.target.files[0];
        this.onChange(field_name, field, null, { target: { value: file } });
    },
    handleAddArray: function handleAddArray(field_name, field) {
        if (this.props.loading) {
            return;
        }
        var change = {};
        change[field_name] = this.props.state[field_name].concat([{}]);
        var input = $.extend({}, this.props.state, change);
        this.props.onChange(input);
    },
    handleDeleteArray: function handleDeleteArray(field_name, field, index) {
        if (this.props.loading) {
            return;
        }
        var new_arr = this.props.state[field_name].slice(0);
        new_arr.splice(index, 1);
        var change = {};
        change[field_name] = new_arr;
        var input = $.extend({}, this.props.state, change);
        this.props.onChange(input);
    },
    handleArrayChange: function handleArrayChange(field_name, field, index, value) {
        if (this.props.loading) {
            return;
        }
        var new_arr = this.props.state[field_name].slice(0);
        new_arr[index] = value;
        var change = {};
        change[field_name] = new_arr;
        var input = $.extend({}, this.props.state, change);
        this.props.onChange(input);
    },
    createFieldInput: function createFieldInput(field_name, field, value) {

        var this_ref = this;
        var is_loading = this.props.loading;
        var inputs = [];
        if (field.type === "entity" || field.type === "multientity") {
            var mode = { mode: field.type === "multientity" ? "multiselect" : "select", label: "Select", entity: field.entity, value: value, onChange: this.onChange.bind(this, field_name, field, null) };
            var input = React.createElement(_item_table.ItemTable, { entity: field.entity, mode: mode, columns: this.props.columns, moveHeader: this.props.moveHeader, fixedFilter: field.filter });
        } else if (field.type === "info") {
            var text_lines = [];
            field.text.split("\n").forEach(function (para, index) {
                text_lines.push(React.createElement(
                    'p',
                    { key: index },
                    para
                ));
            });
            var input = React.createElement(
                'label',
                null,
                text_lines
            );
        } else if (field.type === "boolean") {
            var input = React.createElement(
                'select',
                { className: "form-control", id: field_name, onChange: this.onChange.bind(this, field_name, field, null), value: value, disabled: is_loading },
                React.createElement(
                    'option',
                    { value: 'true' },
                    'True'
                ),
                React.createElement(
                    'option',
                    { value: 'false' },
                    'False'
                )
            );
        } else if (field.type === "integer" || field.type === "decimal") {
            var input = React.createElement('input', { type: 'number', className: "form-control", id: field_name, onChange: this.onChange.bind(this, field_name, field, null), value: value, disabled: is_loading });
        } else if (field.type === "select") {
            var options = [];
            field.choices.forEach(function (op) {
                if (typeof op === "string") {
                    var op_val = op;
                    var op_label = op;
                } else {
                    var op_val = op.value;
                    var op_label = op.label;
                }
                options.push(React.createElement(
                    'option',
                    { key: op_val, value: op_val },
                    op_label
                ));
                if (op.input !== undefined && op_val === value) {
                    for (var fname in op.input) {
                        var val = this_ref.props.state[fname] !== undefined ? this_ref.props.state[fname] : op.input[fname].default || "";
                        inputs = inputs.concat(this_ref.createFieldInput(fname, op.input[fname], val));
                    }
                }
            });
            var input = React.createElement(
                'select',
                { className: "form-control", id: field_name, onChange: this.onChange.bind(this, field_name, field, null), value: value, disabled: is_loading },
                options
            );
        } else if (field.type === "array") {
            inputs.push({ field: { label: "", required: false }, field_name: field_name, input: React.createElement(
                    'b',
                    null,
                    field.label
                ) });
            value.forEach(function (val, index) {
                inputs.push({ field: { required: false, label: "# " + index }, field_name: field_name + index, input: React.createElement(
                        'div',
                        null,
                        React.createElement('i', { className: 'fa fa-times action-icon', 'aria-hidden': 'true', onClick: this.handleDeleteArray.bind(this, field_name, field, index) }),
                        React.createElement(FieldInput, { input: field.input, state: this.props.state[field_name][index], loading: this.props.loading, onChange: this.handleArrayChange.bind(this, field_name, field, index), columns: this.props.columns, moveHeader: this.props.moveHeader })
                    ) });
            }, this);
            inputs.push({ field: { label: "Add", required: false }, field_name: field_name + "_add", input: React.createElement('i', { className: 'fa fa-plus action-icon', 'aria-hidden': 'true', onClick: this.handleAddArray.bind(this, field_name, field) }) });
        } else if (field.type === "date" || field.type === "datetime") {
            if (value === null || value === "") {
                var input = React.createElement(
                    'span',
                    { className: 'form-inline' },
                    React.createElement('input', { type: 'date', className: "form-control", placeholder: 'yyyy-mm-dd', onChange: this.onChange.bind(this, field_name, field, "date"), value: "", disabled: is_loading })
                );
            } else {
                var date_val = new Date(value * 1000);
                var month = date_val.getUTCMonth() + 1;
                var date = date_val.getUTCDate();
                var hour = date_val.getUTCHours();
                var minute = date_val.getUTCMinutes();
                var second = date_val.getUTCSeconds();
                if (month < 10) {
                    month = "0" + month;
                }
                if (date < 10) {
                    date = "0" + date;
                }
                date_val = date_val.getFullYear() + "-" + month + "-" + date;

                var hours = [];
                for (var i = 0; i < 24; i++) {
                    hours.push(React.createElement(
                        'option',
                        { key: i, value: i },
                        i < 10 ? "0" + i : i
                    ));
                }
                var minutes = [];
                for (var i = 0; i < 60; i++) {
                    minutes.push(React.createElement(
                        'option',
                        { key: i, value: i },
                        i < 10 ? "0" + i : i
                    ));
                }

                var input = React.createElement(
                    'span',
                    { className: 'form-inline' },
                    React.createElement('input', { type: 'date', className: "form-control", placeholder: 'yyyy-mm-dd', onChange: this.onChange.bind(this, field_name, field, "date"), value: date_val,
                        disabled: is_loading }),
                    '  ',
                    React.createElement(
                        'select',
                        { className: "form-control", onChange: this.onChange.bind(this, field_name, field, "hour"), value: hour, disabled: is_loading },
                        hours
                    ),
                    ' : ',
                    React.createElement(
                        'select',
                        { className: "form-control", onChange: this.onChange.bind(this, field_name, field, "minute"), value: minute, disabled: is_loading },
                        minutes
                    ),
                    ' : ',
                    React.createElement(
                        'select',
                        { className: "form-control", onChange: this.onChange.bind(this, field_name, field, "second"), value: second, disabled: is_loading },
                        minutes
                    )
                );
            }
        } else if (field.type === "clipboard") {
            var input = React.createElement(
                'span',
                null,
                React.createElement(
                    'button',
                    { className: "btn btn-info", onClick: this.handleCopyClipboard.bind(this, field.text, field_name, field) },
                    'Copy to Clipboard'
                ),
                ' ',
                value
            );
        } else if (field.type === "file") {
            var input = React.createElement(
                'form',
                null,
                React.createElement('input', { type: 'file', className: "modal-file-upload", 'data-name': field_name, onChange: this.handleFileChange.bind(this, field_name, field) })
            );
        } else {
            //console.log("Unknown type " +  field.type);
            var input = React.createElement('input', { type: 'text', className: "form-control", id: field_name, onChange: this.onChange.bind(this, field_name, field, null), value: value, disabled: is_loading });
        }
        if (input !== undefined) {
            var input_obj = { field: field, field_name: field_name, input: input };
            inputs.unshift(input_obj);
        }
        return inputs;
    },
    createField: function createField(field_name) {
        var field = this.props.input[field_name];
        // var value = this.state.input[field_name];
        var value = this.props.state[field_name];

        if (field === undefined || value === undefined) {
            //console.log("return NULL for " + field_name);
            return null;
        }

        var inputs = this.createFieldInput(field_name, field, value);
        var elements = [];
        inputs.forEach(function (input) {
            var required = input.field.required ? " *" : "";
            elements.push(React.createElement(
                'div',
                { key: input.field_name, className: 'form-group' },
                React.createElement(
                    'label',
                    { 'for': input.field_name, className: "col-sm-2 control-label" },
                    input.field.label,
                    required
                ),
                React.createElement(
                    'div',
                    { className: "col-sm-10" },
                    input.input
                )
            ));
        });

        return elements;
    },
    render: function render() {
        if (this.props.state === null) {
            return null;
        }
        var fields = this.props.input;
        return React.createElement(
            'div',
            null,
            Object.keys(fields).map(this.createField)
        );
    }
});

////////////////////////////////////////////////////////////////////////////////
// Input Modal
////////////////////////////////////////////////////////////////////////////////
var InputModal = exports.InputModal = React.createClass({
    displayName: 'InputModal',

    getInitialState: function getInitialState() {
        return { input: null, loading: false, report: null, error_msg: null };
    },
    componentWillReceiveProps: function componentWillReceiveProps(props) {

        if (props.input === null || this.props.input !== null) {
            return;
        }
        this.setState({ input: null, loading: false, report: null, error_msg: null });
    },
    onFieldChange: function onFieldChange(input) {
        this.setState({ input: input });
    },
    handleOK: function handleOK() {
        if (this.state.loading) {
            return;
        }

        if (this.props.input !== null) {
            for (var fieldName in this.props.input.input) {
                var field = this.props.input.input[fieldName];
                if (field.type === "entity" && this.state.input[fieldName] === "") {
                    this.setState({ error_msg: "Must select one " + fieldName });
                    return;
                }
                if (field.required && this.state.input[fieldName] === "") {
                    this.setState({ error_msg: "Must enter a value for '" + fieldName + "'" });
                    return;
                }
            }
        }

        this.setState({ loading: true });
        var this_ref = this;
        this.props.input.callback(this.state.input, function (success, err_msg) {
            if (success) {
                if (err_msg === undefined || err_msg === null) {
                    this_ref.props.hideModal();
                } else {
                    if (typeof err_msg === "string") {
                        var report = { type: "text", text: err_msg };
                    } else {
                        var report = err_msg;
                    }
                    this_ref.setState({ loading: false, report: report, error_msg: null });
                }
            } else {
                this_ref.setState({ loading: false, error_msg: err_msg });
            }
        });
    },
    render: function render() {
        if (this.props.input === null) {
            return null;
        }

        var is_loading = this.state.loading;

        if (this.state.report !== null) {

            if (this.state.report.type === "text") {
                var report = [];
                this.state.report.text.split("\n").forEach(function (para, index) {
                    report.push(React.createElement(
                        'p',
                        { key: index },
                        para
                    ));
                });
            } else if (this.state.report.type === "chart") {
                var report = React.createElement(ChartContainer, { data: this.state.report.data, field: this.state.report.field });
            } else {
                var report = React.createElement(
                    'span',
                    null,
                    'Unknown report type'
                );
            }

            var contents = React.createElement(
                'div',
                { className: "row" },
                React.createElement(
                    'h2',
                    null,
                    this.props.input.heading
                ),
                React.createElement(
                    'div',
                    { className: "col-sm-12" },
                    report
                ),
                React.createElement(
                    'div',
                    { className: "col-sm-12" },
                    React.createElement(
                        'button',
                        { className: "btn btn-success", onClick: this.props.hideModal },
                        'OK'
                    )
                )
            );
        } else {

            var error_report = null;
            if (this.state.error_msg !== null) {
                error_report = [];
                this.state.error_msg.split("\n").forEach(function (para, index) {
                    error_report.push(React.createElement(
                        'p',
                        { key: index },
                        para
                    ));
                });
            }

            var contents = React.createElement(
                'div',
                { className: "row" },
                React.createElement(
                    'h2',
                    null,
                    this.props.input.heading
                ),
                React.createElement(FieldInput, { input: this.props.input.input, state: this.state.input, loading: this.state.loading, onChange: this.onFieldChange, columns: this.props.columns, moveHeader: this.props.moveHeader }),
                React.createElement(
                    'div',
                    { className: "col-sm-offset-2", style: { color: "red" } },
                    error_report
                ),
                React.createElement(
                    'div',
                    { className: "col-sm-offset-2" },
                    React.createElement(
                        'button',
                        { className: "btn btn-success", onClick: this.handleOK, disabled: is_loading },
                        'OK'
                    ),
                    React.createElement(
                        'button',
                        { className: "btn btn-danger", onClick: this.props.hideModal, disabled: is_loading },
                        'Cancel'
                    )
                )
            );
        }

        var outer_style = { position: "absolute", zIndex: 100, left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(128,128,128, 0.5)", pointerEvents: "auto" };
        var inner_style = { position: "absolute", left: "10%", right: "10%", top: "10%", bottom: "10%", backgroundColor: "rgba(255,255,255, 1.0)", overflowY: "scroll" };
        return React.createElement(
            'div',
            { style: outer_style },
            React.createElement(
                'div',
                { style: inner_style },
                React.createElement(
                    'div',
                    { className: "container", style: { padding: "5px" } },
                    React.createElement(
                        'div',
                        { className: "form-horizontal" },
                        contents
                    )
                )
            )
        );
    }
});

},{"./item_table.jsx":4}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ItemRow = undefined;

var _item_table = require("./item_table.jsx");

////////////////////////////////////////////////////////////////////////////////
// Item Row
////////////////////////////////////////////////////////////////////////////////
var ItemRow = exports.ItemRow = React.createClass({
    displayName: "ItemRow",

    getInitialState: function getInitialState() {
        return { expand: null };
    },
    getIdentifiers: function getIdentifiers() {
        var identifier = {};
        var this_ref = this;
        this.props.entity.identifiers.forEach(function (id_name) {
            identifier[id_name] = this_ref.props.item[id_name];
        });
        return identifier;
    },
    handleExpand: function handleExpand(association) {
        if (this.state.expand !== null && this.state.expand.fieldName === association.fieldName) {
            var new_expand = null;
        } else {
            var new_expand = association;
        }
        this.setState({ expand: new_expand });
    },
    handleEdit: function handleEdit(field) {
        var value = this.props.item[field.fieldName];
        var is_null = value === null;

        var controls = {};
        var val_ctrl = { type: field.type, label: field.label, default: is_null ? "" : value };
        if (field.choices !== undefined) {
            val_ctrl.type = "select";
            val_ctrl.choices = field.choices;
        }
        if (field.nullable === true) {
            controls['is_null'] = { type: "select", label: "Set to empty?", default: is_null ? "true" : "false", choices: [{ value: "true", label: "Empty" }, { value: "false", label: "Not Empty", input: {
                        value: val_ctrl
                    } }] };
        } else {
            controls['value'] = val_ctrl;
        }
        //controls['value'] = { type: field.type, label: field.label, default: (is_null ? "" : value)};

        var this_ref = this;
        this.props.showModal("Edit " + field.label, controls, function (input, callback) {
            var send_value = input.is_null === "true" ? null : input.value;
            this_ref.props.editItem(this_ref.getIdentifiers(), field.fieldName, send_value, function (success, err_msg) {
                callback(success, err_msg);
            });
        });
    },
    handleAction: function handleAction(action) {
        this.props.actionItem(this.getIdentifiers(), action);
    },
    handleCreate: function handleCreate(assoc) {

        var preselected = {};
        if (assoc.mappedBy !== undefined) {
            preselected[assoc.mappedBy] = this.getIdentifiers();
        }
        this.props.itemCreate(assoc.targetEntity, preselected);
    },
    createAction: function createAction(action) {

        var classes = "btn btn-xs ";
        if (action.class !== undefined) {
            classes += action.class;
        }

        if (action.input === undefined) {
            return React.createElement(
                "span",
                { key: action.name, className: classes },
                action.label
            );
        }

        return React.createElement(
            "button",
            { key: action.name, className: classes, onClick: this.handleAction.bind(this, action) },
            action.label
        );
    },
    createActionGroup: function createActionGroup(action_heading, width, classes) {
        if (this.props.mode !== undefined) {
            return null;
        }

        var actions = [];
        this.props.item._ACTIONS.forEach(function (action) {
            if (action.heading === action_heading) {
                actions.push(action);
            }
        });
        return React.createElement(
            "div",
            { key: action_heading, className: "data-cell data-sm" + classes, style: { width: width } },
            actions.map(this.createAction)
        );
    },
    createAssociation: function createAssociation(association, width, classes) {
        if (this.state.expand !== null && this.state.expand.fieldName === association.fieldName) {
            return React.createElement(
                "div",
                { key: association.fieldName, className: "data-cell data-sm", style: { width: width } },
                React.createElement(
                    "button",
                    { className: "btn btn-xs btn-warning", onClick: this.handleExpand.bind(this, association) },
                    "Collapse"
                )
            );
        }

        var assoc_field = this.props.item[association.fieldName];
        if (assoc_field === null) {
            return React.createElement(
                "div",
                { key: association.fieldName, className: "data-cell data-sm", style: { width: width } },
                "NULL"
            );
        }

        var expansion = null;
        if (association.expand_permission) {
            var expand_text = " + ";
            if (assoc_field !== undefined) {
                if (assoc_field.preview !== undefined) {
                    expand_text += assoc_field.preview;
                } else if (assoc_field.count !== undefined) {
                    expand_text += assoc_field.count;
                }
            }

            expansion = React.createElement(
                "button",
                { className: "btn btn-xs", onClick: this.handleExpand.bind(this, association) },
                expand_text
            );
        } else {
            var expand_text = assoc_field.count !== undefined ? assoc_field.count : "1 Item";
            expansion = React.createElement(
                "span",
                null,
                expand_text
            );
        }

        var create_temp = null;
        if (association.create_permission && this.props.mode === undefined) {
            create_temp = React.createElement("i", { className: "fa fa-plus action-icon", "aria-hidden": "true", onClick: this.handleCreate.bind(this, association) });
        }

        return React.createElement(
            "div",
            { key: association.fieldName, className: "data-cell data-sm" + classes, title: expand_text, style: { width: width } },
            create_temp,
            expansion
        );
    },
    createField: function createField(field_name, width, classes) {
        var field = this.props.entity.fields[field_name];
        // var editable = (field.id !== true) && (field.editable) && ((field.type === "string") || (field.type === "text") || (field.type === "boolean") || (field.type === "integer") || (field.type === "decimal"));
        var editable = field.id !== true && field.editable && (field.type === "string" || field.type === "text" || field.type === "boolean" || field.type === "integer" || field.type === "decimal" || field.type === "date" || field.type === "datetime");
        editable = editable && this.props.mode === undefined;

        var value = this.props.item[field_name];

        var text = value;
        if (value === undefined) {
            text = "---";
        } else if (value === null) {
            text = "NULL";
        } else if (field.type === "datetime" || field.type === "date") {
            text = value.date;
        }
        text += "";

        var edit_markup = null;
        if (editable) {
            edit_markup = React.createElement("i", { className: "fa fa-pencil action-icon", "aria-hidden": "true", onClick: this.handleEdit.bind(this, field) });
        }
        return React.createElement(
            "div",
            { key: field_name, title: text, className: "data-cell" + classes, style: { width: width } },
            edit_markup,
            text
        );
    },
    createExpansion: function createExpansion() {

        var assoc = this.state.expand;

        // var assoc_field = null;
        if (assoc.type_name === "many_one" || assoc.type_name === "one_one") {

            if (this.props.item[assoc.fieldName] === undefined) {
                return React.createElement(
                    "div",
                    { className: "data-row data-expansion" },
                    "Field name not found"
                );
            }

            var identifier = this.props.item[assoc.fieldName].identifiers;
        } else {
            if (assoc.mappedBy === undefined && assoc.inversedBy === undefined) {
                return React.createElement(
                    "div",
                    { className: "data-row data-expansion" },
                    "One-to-many and many-to-many associations need to have 'mappedBy' or 'inversedBy'"
                );
            }

            if (assoc.mappedBy !== undefined) {
                var assoc_field = assoc.mappedBy;
            } else {
                var assoc_field = assoc.inversedBy;
            }
            var identifier = this.getIdentifiers();
        }

        return React.createElement(
            "div",
            { className: "data-row data-expansion" },
            React.createElement(_item_table.ItemTable, { entity: assoc.targetEntity, "associated-value": identifier, "associated-field": assoc_field, "associated-type": assoc.type_name, mode: this.props.mode, showModal: this.props.showModal, columns: this.props.columns, moveHeader: this.props.moveHeader })
        );
    },
    render: function render() {

        var associations = [];
        for (var type in this.props.entity.associations) {
            associations = associations.concat(this.props.entity.associations[type]);
        }

        var mode = null;
        if (this.props.mode !== undefined && this.props.mode.onChange !== undefined && this.props.mode.entity === this.props.entityName) {
            var ids = this.getIdentifiers();

            var multi = this.props.mode.mode === "multiselect";
            if (multi) {
                var potentials = this.props.mode.value;
            } else {
                var potentials = [this.props.mode.value];
            }

            var is_selected = potentials.some(function (select) {
                var selected = true;
                for (var propname in ids) {
                    if (ids[propname] !== select[propname]) {
                        selected = false;
                        break;
                    }
                }
                return selected;
            });
            /*
             var button_text = "Select";
             if(is_selected) {
             var classes = "data-cell data-sm selected";
             var button_classes = "btn btn-success btn-xs";
             if(multi) {
             button_text = "Deselect";
             } else {
             button_text = "Selected";
             }
             } else {
             var classes = "data-cell data-sm";
             var button_classes = "btn btn-info btn-xs";
             }
             */
            if (multi) {
                var select_ctrl = React.createElement(
                    "span",
                    { onClick: this.props.mode.onChange.bind(this, ids) },
                    React.createElement("input", { type: "checkbox", checked: is_selected, readOnly: true }),
                    is_selected ? "Selected" : "Select"
                );
            } else {
                if (is_selected) {
                    var button_text = "Selected";
                    var button_classes = "btn btn-success btn-xs";
                } else {
                    var button_text = "Select";
                    var button_classes = "btn btn-info btn-xs";
                }
                var select_ctrl = React.createElement(
                    "button",
                    { className: button_classes, onClick: this.props.mode.onChange.bind(this, ids) },
                    button_text
                );
            }

            mode = React.createElement(
                "div",
                { className: "data-cell data-sm" + (is_selected ? " selected" : ""), title: "Select" },
                select_ctrl
            );
        }

        // sorts the columns, specifies their widths and classes
        var this_ref = this;
        var column_funcs = [];
        this.props.entity.actions.forEach(function (action) {
            column_funcs.push({ func: this_ref.createActionGroup, arg: action.label, order: "_action_" + action.label });
        });
        associations.forEach(function (association) {
            column_funcs.push({ func: this_ref.createAssociation, arg: association, order: association.fieldName });
        });
        for (var fieldName in this.props.entity.fields) {
            column_funcs.push({ func: this_ref.createField, arg: fieldName, order: fieldName });
        }

        var entity_columns = this.props.columns[this.props.entityName];
        var columns = [];
        column_funcs.forEach(function (col_func) {

            var sorted = this_ref.props.sortFields.some(function (sort) {
                return col_func.order === sort.name;
            });
            var filtered = this_ref.props.filterFields.some(function (filter) {
                return col_func.order === filter.name;
            });
            var col_classes = " ";
            if (sorted) {
                col_classes += "sorted";
            }
            if (filtered) {
                col_classes += "filtered";
            }

            var order = entity_columns[col_func.order];
            columns[order.index] = col_func.func(col_func.arg, order.width, col_classes);
        });

        var data_row = React.createElement(
            "div",
            { className: "data-row" },
            mode,
            columns
        );

        if (this.state.expand === null) {
            return data_row;
        }

        return React.createElement(
            "div",
            null,
            data_row,
            this.createExpansion()
        );
    }
}); /**
     * Created by Grigory on 14-Dec-16.
     */

},{"./item_table.jsx":4}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ItemTable = undefined;

var _item_row = require("./item_row.jsx");

////////////////////////////////////////////////////////////////////////////////
// Item Table
////////////////////////////////////////////////////////////////////////////////
var ItemTable = exports.ItemTable = React.createClass({
    displayName: "ItemTable",


    getInitialState: function getInitialState() {

        var filter_fields = [];

        // gets fixed filters and initializes table with them
        var entity = g_InitialData.entities[this.props.entity];
        if (this.props.fixedFilter !== undefined) {
            for (var fieldName in this.props.fixedFilter) {
                var new_filter = this.getNewFilterObject(entity.fields[fieldName], this.props.fixedFilter[fieldName]);
                if (new_filter !== null) {
                    filter_fields.push(new_filter);
                }
            }
        }

        return { data: null, loading: 0, debounce: null, page: 0, pageSize: 10, sortFields: [], filterFields: filter_fields, dragField: null, dragPos: null };
    },
    componentDidMount: function componentDidMount() {
        this.refresh();
    },
    componentWillReceiveProps: function componentWillReceiveProps(props) {

        var values_identical = true;
        for (var name in props["associated-value"]) {
            if (props["associated-value"][name] !== this.props["associated-value"][name]) {
                values_identical = false;
                break;
            }
        }

        if (props.entity === this.props.entity && props["associated-field"] === this.props["associated-field"] && props["associated-type"] === this.props["associated-type"] && values_identical) {
            return;
        }

        this.setState({ data: null });
        this.loadItemData(props, 0, 10, [], []);
    },
    refresh: function refresh() {
        this.loadItemData(this.props, this.state.page, this.state.pageSize, this.state.sortFields, this.state.filterFields);
    },
    refreshItem: function refreshItem(item) {

        var this_ref = this;
        var entity = g_InitialData.entities[this.state.data.entity];

        for (var i = 0; i < this.state.data.items.length; i++) {
            var old = this.state.data.items[i];

            var match = entity.identifiers.every(function (name) {
                return old[name] === item[name];
            });
            if (match) {
                var new_items = this.state.data.items.slice(0);
                new_items[i] = item;
                var new_data = $.extend({}, this_ref.state.data, { items: new_items });
                this_ref.setState({ data: new_data });
                return;
            }
        }
    },
    refreshPageZero: function refreshPageZero() {
        this.loadItemData(this.props, 0, this.state.pageSize, this.state.sortFields, this.state.filterFields);
    },
    loadItemData: function loadItemData(props, page, page_size, sort_fields, filter_fields) {
        var loading_num = this.state.loading + 1;
        this.setState({ page: page, pageSize: page_size, loading: loading_num, sortFields: sort_fields, filterFields: filter_fields, dragField: null, dragPos: null });

        var send_data = {
            entity: props.entity,
            page: page,
            pageSize: page_size,
            sort: sort_fields,
            filter: filter_fields,
            "associated-value": props["associated-value"],
            "associated-field": props["associated-field"],
            "associated-type": props["associated-type"]
        };

        var this_ref = this;
        var setData = function setData(data) {
            if (this_ref.state.loading === loading_num) {
                this_ref.setState({ data: data, loading: 0 });
            }
        };

        $.ajax({
            type: "POST",
            url: g_InitialData.data_route,
            dataType: "json",
            data: send_data
        }).done(function (data) {
            setData(data);
        }).error(function (data) {
            if (data.responseJSON !== undefined) {
                setData(data.responseJSON.result);
            } else {
                setData("Unknown Error");
            }
        });
    },
    getNewFilterObject: function getNewFilterObject(field, fixed_value) {

        if (field === undefined) {
            return null;
        }

        var new_filter = { name: field.fieldName, type: field.type, value: "", immediate: false, fixed: fixed_value !== undefined };

        if (field.nullable) {
            new_filter.only_null = false;
            new_filter.immediate = true;
        }

        if (field.choices !== undefined) {
            new_filter.type = "choice";
            new_filter.choices = field.choices;
            new_filter.value = {};
            new_filter.choices.forEach(function (choice) {
                if (fixed_value !== undefined) {
                    new_filter.value[choice] = fixed_value === choice || fixed_value.indexOf(choice) !== -1;
                } else {
                    new_filter.value[choice] = true;
                }
            });
            new_filter.immediate = true;
        } else if (field.type === "boolean") {
            new_filter.value = true;
            if (fixed_value !== undefined) {
                new_filter.value = fixed_value === true || fixed_value === "true";
            }
            new_filter.immediate = true;
        } else if (field.type === "decimal" || field.type === "integer") {
            if (fixed_value !== undefined) {
                new_filter.value = fixed_value;
            } else {
                new_filter.value = { min: "", max: "" };
            }
        } else if (field.type === "date" || field.type === "datetime") {
            if (fixed_value !== undefined) {
                new_filter.value = fixed_value;
            } else {
                new_filter.value = { min: "", max: "" };
            }
        }

        return new_filter;
    },
    handleFilter: function handleFilter(field) {

        var new_filter_fields = this.state.filterFields.slice(0);

        var found = false;
        $.each(new_filter_fields, function (index, filter_field) {
            if (filter_field.name === field.fieldName) {
                found = true;
                return false;
            }
        });

        if (found) {
            return;
        }

        var new_filter = this.getNewFilterObject(field);

        new_filter_fields.push(new_filter);
        if (new_filter.immediate) {
            this.loadItemData(this.props, 0, this.state.pageSize, this.state.sortFields, new_filter_fields);
        } else {
            this.setState({ filterFields: new_filter_fields });
        }
    },
    handleFilterDelete: function handleFilterDelete(filter) {

        if (filter.fixed) {
            return;
        }

        var new_filter_fields = this.state.filterFields.slice(0);
        $.each(new_filter_fields, function (index, filter_field) {
            if (filter === filter_field) {
                new_filter_fields.splice(index, 1);
                return false;
            }
        });

        this.loadItemData(this.props, 0, this.state.pageSize, this.state.sortFields, new_filter_fields);
    },
    handleFilterChange: function handleFilterChange(filter, debounce, sub_value, only_null, evnt) {

        if (filter.fixed) {
            return;
        }

        var this_ref = this;
        var new_filter_fields = this.state.filterFields.slice(0);
        $.each(new_filter_fields, function (index, filter_field) {
            if (filter === filter_field) {
                if (only_null) {
                    filter_field.only_null = evnt.target.value === "true";
                } else {
                    if (sub_value === null) {
                        filter_field.value = evnt.target.value;
                    } else {
                        filter_field.value[sub_value] = evnt.target.value;
                    }
                }

                if (debounce) {
                    clearTimeout(this_ref.state.debounce);
                    var newtimeout = setTimeout(this_ref.refreshPageZero, 500);
                    this_ref.setState({ filterFields: new_filter_fields, debounce: newtimeout });
                } else {
                    this_ref.loadItemData(this_ref.props, 0, this_ref.state.pageSize, this_ref.state.sortFields, new_filter_fields);
                }

                return false;
            }
        });
    },
    handleSort: function handleSort(fieldName, type) {

        var new_sort_fields = this.state.sortFields.slice(0);

        var found = false;
        $.each(new_sort_fields, function (index, sort_field) {
            if (sort_field.name === fieldName) {
                found = true;
                if (!sort_field.ascend) {
                    sort_field.ascend = true;
                } else {
                    new_sort_fields.splice(index, 1);
                }
                return false;
            }
        });

        if (found === false) {
            new_sort_fields.push({ name: fieldName, ascend: false, type: type });
        }

        this.loadItemData(this.props, this.state.page, this.state.pageSize, new_sort_fields, this.state.filterFields);
    },
    handlePage: function handlePage(page) {
        var total_pages = Math.ceil(this.state.data.total_items / this.state.pageSize);

        if (page < 0 || page >= total_pages || page === this.state.page) {
            return;
        }
        this.loadItemData(this.props, page, this.state.pageSize, this.state.sortFields, this.state.filterFields);
    },
    handlePageSize: function handlePageSize(evnt) {
        this.loadItemData(this.props, 0, evnt.target.value, this.state.sortFields, this.state.filterFields);
    },
    handleMoveHeaderClick: function handleMoveHeaderClick(field_name, is_down, evnt) {
        if (is_down) {
            this.setState({ dragField: field_name, dragPos: evnt.clientX });
        } else {
            this.setState({ dragField: null, dragPos: null });
        }
    },
    handleMoveHeaderMove: function handleMoveHeaderMove(evnt) {
        if (this.state.dragField === null) {
            return;
        }
        if (evnt.buttons === 0) {
            this.setState({ dragField: null, dragPos: null });
            return;
        }
        var diff = evnt.clientX - this.state.dragPos;
        this.setState({ dragPos: evnt.clientX });
        this.props.moveHeader(this.props.entity, this.state.dragField, diff);
        evnt.preventDefault();
        evnt.stopPropagation();
    },
    handleChart: function handleChart() {

        var choices = [];

        var entity = g_InitialData.entities[this.props.entity];
        for (var fieldName in entity.fields) {
            var field = entity.fields[fieldName];
            if (field.type === "date" || field.type === "datetime" || field.type === "integer" || field.type === "decimal") {
                choices.push({ value: fieldName, label: field.label });
            }
        }
        if (choices.length < 0) {
            return;
        }
        var controls = { attribute: { type: "select", choices: choices, label: "Attribute to graph" } };

        var send_data = {
            entity: this.props.entity,
            filter: this.state.filterFields,
            "associated-value": this.props["associated-value"],
            "associated-field": this.props["associated-field"],
            "associated-type": this.props["associated-type"]
        };

        //var this_ref = this;
        this.props.showModal("Graph attributes for " + entity.label, controls, function (input, callback) {

            send_data.groupBy = input.attribute;

            $.ajax({
                type: "POST",
                url: g_InitialData.graph_route,
                dataType: "json",
                data: send_data
            }).done(function (data) {
                callback(true, { type: "chart", data: data, field: entity.fields[input.attribute] });
            }).error(function (data) {
                if (data.responseJSON !== undefined) {
                    callback(false, data.responseJSON.result);
                } else {
                    callback(false, "Unknown Error");
                }
            });
        });
    },
    handleStats: function handleStats() {

        var choices = [];

        var entity = g_InitialData.entities[this.props.entity];
        for (var fieldName in entity.fields) {
            var field = entity.fields[fieldName];
            if (field.type === "integer" || field.type === "decimal") {
                choices.push({ value: fieldName, label: field.label });
            }
        }
        if (choices.length < 0) {
            return;
        }
        var controls = { attribute: { type: "select", choices: choices, label: "Attribute to get stats for" } };

        var send_data = {
            entity: this.props.entity,
            filter: this.state.filterFields,
            "associated-value": this.props["associated-value"],
            "associated-field": this.props["associated-field"],
            "associated-type": this.props["associated-type"]
        };

        this.props.showModal("Stats for " + entity.label, controls, function (input, callback) {

            send_data.groupBy = input.attribute;

            $.ajax({
                type: "POST",
                url: g_InitialData.stats_route,
                dataType: "json",
                data: send_data
            }).done(function (data) {
                var total = parseFloat(data.stats_count);
                var sum = parseFloat(data.stats_sum);
                var sum_squares = parseFloat(data.stats_sum_squares);
                var mean = sum / total;
                var std_dev = sum_squares / total - mean * mean;
                if (std_dev > 0.000001) {
                    std_dev = Math.sqrt(std_dev);
                } else {
                    std_dev = 0;
                }
                var msg = "Min: " + data.stats_min + "\n" + "Max: " + data.stats_max + "\n" + "Sum: " + sum + "\n" + "Mean: " + mean + "\n" + "Standard Deviation: " + std_dev + "\n" + "Total: " + total + "\n";
                callback(true, msg);
            }).error(function (data) {
                if (data.responseJSON !== undefined) {
                    callback(false, data.responseJSON.result);
                } else {
                    callback(false, "Unknown Error");
                }
            });
        });
    },
    handleDownload: function handleDownload() {

        var send_data = {
            entity: this.props.entity,
            filter: this.state.filterFields,
            "associated-value": this.props["associated-value"],
            "associated-field": this.props["associated-field"],
            "associated-type": this.props["associated-type"]
        };

        var url_data = $.param(send_data);

        this.props.showModal("Download table results", {}, function (input, callback) {
            window.location = g_InitialData.export_route + "?" + url_data;
            callback(true);
        });
    },
    handleFakeData: function handleFakeData() {
        var controls = {
            "amount": { type: "integer", label: "Number of rows to add to this table", default: 0 },
            "sure": { type: "boolean", label: "Are you sure?", default: false }
        };
        var this_ref = this;
        this.props.showModal("Fill this table full of fake data", controls, function (input, callback) {
            if (input.sure !== true) {
                callback(false, "Confirm you are sure about adding fake data to the table");
                return;
            }

            $.ajax({
                type: "POST",
                url: g_InitialData.fake_data_route,
                dataType: "json",
                data: {
                    entity: this_ref.props.entity,
                    amount: input.amount
                }
            }).done(function (data) {
                callback(true);
                this_ref.refresh();
            }).error(function (data) {
                if (data.responseJSON !== undefined) {
                    callback(false, data.responseJSON.result);
                } else {
                    callback(false, "Unknown Error");
                }
            });
        });
    },
    doesFieldAffectOrder: function doesFieldAffectOrder(fieldName) {
        var affects = this.state.sortFields.some(function (sort) {
            return sort.name === fieldName;
        });
        if (affects) return true;
        return this.state.filterFields.some(function (filter) {
            return filter.name === fieldName;
        });
    },
    editItem: function editItem(identifiers, field, value, callback) {
        if (this.state.loading) {
            return;
        }

        var this_ref = this;
        $.ajax({
            type: "POST",
            url: g_InitialData.edit_route,
            contentType: "application/json",
            data: JSON.stringify({ entity: this_ref.props.entity, identifiers: identifiers, field: field, value: value })
        }).done(function (data) {

            var edit_index = null;
            $.each(this_ref.state.data.items, function (index, item) {
                for (var id_name in identifiers) {
                    if (item[id_name] !== identifiers[id_name]) {
                        return;
                    }
                }

                edit_index = index;
                return false;
            });
            if (edit_index === null) {
                return;
            }
            var new_data = $.extend({}, this_ref.state.data);
            new_data.items = new_data.items.slice(0);
            new_data.items[edit_index] = data.item;

            this_ref.setState({ data: new_data });
            if (callback !== undefined) {
                callback(true);
            }
        }).error(function (data) {
            if (callback !== undefined) {
                callback(false, data.responseJSON.result);
            }
        });
    },
    actionItem: function actionItem(identifiers, action) {
        if (this.state.loading) {
            return;
        }

        var this_ref = this;
        var ajax_call = function ajax_call(input, callback) {

            $.ajax({
                type: "POST",
                url: g_InitialData.action_route,
                dataType: "json",
                data: { entity: this_ref.props.entity, identifiers: identifiers, name: action.name, input: input }
            }).done(function (data) {

                if (callback !== undefined) {
                    callback(true, null);
                }
                // if true is returned, will always refresh
                if (data.affected_fields === true) {
                    this_ref.refresh();
                    return;
                }
                if (data.affected_fields === undefined) {
                    var order_affected = false;
                } else {
                    var order_affected = data.affected_fields.some(function (field_name) {
                        return this_ref.doesFieldAffectOrder(field_name);
                    });
                }

                if (order_affected) {
                    this_ref.refresh();
                } else {
                    this_ref.refreshItem(data.item);
                }
            }).error(function (data) {
                if (callback !== undefined) {
                    callback(false, data.responseJSON === undefined ? "Unknown Error" : data.responseJSON.result);
                }
            });
        };

        if (action.input !== null) {
            this.props.showModal(action.description, action.input, ajax_call);
        } else {
            ajax_call();
        }
    },
    itemCreate: function itemCreate(entity, preselected) {

        var this_ref = this;
        var target = g_InitialData.entities[entity];

        var controls = {};

        if (target.creation === undefined) {
            for (var field_name in target.fields) {
                var field = target.fields[field_name];
                if (field.id || !field.editable && field.nullable || preselected[field_name] !== undefined) {
                    continue;
                }
                controls[field_name] = { label: field_name, type: field.type, required: field.editable && !field.nullable };
            }
        } else {
            controls = target.creation;
        }

        var assoc_fields = target.associations.many_one.concat(target.associations.one_one);
        assoc_fields.forEach(function (assoc_field) {
            if (preselected[assoc_field.fieldName] !== undefined) {
                var ctrl = {
                    type: "info"
                    //,text: "Already Selected"
                    , text: JSON.stringify(preselected[assoc_field.fieldName])
                };
            } else {
                var ctrl = {
                    type: "entity",
                    entity: assoc_field.targetEntity
                };
            }
            ctrl.label = assoc_field.fieldName;
            controls[assoc_field.fieldName] = ctrl;
        });

        this.props.showModal("Create new " + target.name, controls, function (input, callback) {

            for (var propname in preselected) {
                input[propname] = preselected[propname];
            }

            $.ajax({
                type: "POST",
                url: g_InitialData.create_route,
                dataType: "json",
                data: { entity: entity, input: input }
            }).done(function (data) {

                if (callback !== undefined) {
                    callback(true, null);
                }
                this_ref.refresh();
            }).error(function (data) {
                if (callback !== undefined) {
                    callback(false, data.responseJSON === undefined ? "Unknown Error" : data.responseJSON.result);
                }
            });
        });
    },
    createResize: function createResize(fieldname) {
        return React.createElement("i", { className: "fa fa-arrows-h action-icon pull-right", style: { position: "relative" }, "aria-hidden": "true",
            onMouseDown: this.handleMoveHeaderClick.bind(this, fieldname, true),
            onMouseUp: this.handleMoveHeaderClick.bind(this, fieldname, false) });
    },
    createSortTemplate: function createSortTemplate(field_name, type) {
        // var sort_template = null;
        var multi_sort = this.state.sortFields.length > 1;

        var inner_text = "";
        var icon_class = "fa fa-sort action-icon";
        $.each(this.state.sortFields, function (index, sort_field) {
            if (field_name === sort_field.name) {
                icon_class = sort_field.ascend ? "fa fa-caret-down action-icon" : "fa fa-caret-up action-icon";
                inner_text = multi_sort ? "(" + (index + 1) + ") " : "";
                return false;
            }
        });
        return React.createElement(
            "i",
            { className: icon_class, "aria-hidden": "true", onClick: this.handleSort.bind(this, field_name, type) },
            inner_text
        );
    },
    createActionHeader: function createActionHeader(action, width) {
        if (this.props.mode !== undefined) {
            return null;
        }
        return React.createElement(
            "div",
            { key: "action_" + action, className: "data-cell data-header data-sm", style: { width: width } },
            this.createResize("_action_" + action),
            action
        );
    },
    createAssociationHeader: function createAssociationHeader(assoc, width) {
        return React.createElement(
            "div",
            { key: "association_" + assoc.fieldName, title: assoc.fieldName, className: "data-cell data-header data-sm", style: { width: width } },
            this.createResize(assoc.fieldName),
            this.createSortTemplate(assoc.fieldName, assoc.type_name),
            assoc.label
        );
    },
    createFieldHeader: function createFieldHeader(field_name, width) {
        var entity = g_InitialData.entities[this.state.data.entity];
        var field = entity.fields[field_name];

        return React.createElement(
            "div",
            { key: "field_" + field_name, title: field_name, className: "data-cell data-header", style: { width: width } },
            this.createResize(field_name),
            React.createElement("i", { className: "fa fa-filter action-icon", "aria-hidden": "true", onClick: this.handleFilter.bind(this, field) }),
            this.createSortTemplate(field_name, "field"),
            field.label
        );
    },
    createFilterInput: function createFilterInput(filter) {
        var this_ref = this;
        if (filter.choices !== undefined) {

            var createChoice = function createChoice(choice) {
                return React.createElement(
                    "span",
                    { key: choice },
                    React.createElement("input", { type: "checkbox", checked: filter.value[choice], disabled: filter.fixed, onChange: this_ref.handleFilterChange.bind(this_ref, filter, false, choice, false, { target: { value: !filter.value[choice] } }) }),
                    React.createElement(
                        "label",
                        null,
                        " ",
                        choice,
                        "  "
                    )
                );
            };
            var input = filter.choices.map(createChoice);
        } else if (filter.type === "boolean") {
            var input = React.createElement(
                "select",
                { disabled: filter.fixed, onChange: this.handleFilterChange.bind(this, filter, false, null, false), value: filter.value },
                React.createElement(
                    "option",
                    { value: "true" },
                    "True"
                ),
                React.createElement(
                    "option",
                    { value: "false" },
                    "False"
                )
            );
        } else if (filter.type === "integer" || filter.type === "decimal") {
            var input = React.createElement(
                "span",
                null,
                React.createElement("input", { type: "number", value: filter.value.min, disabled: filter.fixed, onChange: this.handleFilterChange.bind(this, filter, true, "min", false) }),
                React.createElement(
                    "span",
                    null,
                    " to "
                ),
                React.createElement("input", { type: "number", value: filter.value.max, disabled: filter.fixed, onChange: this.handleFilterChange.bind(this, filter, true, "max", false) })
            );
        } else if (filter.type === "date" || filter.type === "datetime") {
            var input = React.createElement(
                "span",
                null,
                React.createElement("input", { type: "date", value: filter.value.min, disabled: filter.fixed, onChange: this.handleFilterChange.bind(this, filter, true, "min", false), placeholder: "yyyy-mm-dd" }),
                React.createElement(
                    "span",
                    null,
                    " to "
                ),
                React.createElement("input", { type: "date", value: filter.value.max, disabled: filter.fixed, onChange: this.handleFilterChange.bind(this, filter, true, "max", false), placeholder: "yyyy-mm-dd" })
            );
        } else {
            var input = React.createElement("input", { type: "text", value: filter.value, disabled: filter.fixed, onChange: this.handleFilterChange.bind(this, filter, true, null, false) });
        }

        if (filter.only_null === undefined) {
            var nullable = null;
        } else {
            var nullable = React.createElement(
                "select",
                { value: filter.only_null, disabled: filter.fixed, onChange: this.handleFilterChange.bind(this, filter, false, null, true) },
                React.createElement(
                    "option",
                    { value: "false" },
                    "Not Null"
                ),
                React.createElement(
                    "option",
                    { value: "true" },
                    "Null"
                )
            );
            if (filter.only_null) {
                input = null;
            }
        }
        if (filter.fixed) {
            var delete_button = null;
        } else {
            var delete_button = React.createElement("i", { className: "fa fa-times action-icon", "aria-hidden": "true", onClick: this.handleFilterDelete.bind(this, filter) });
        }

        return React.createElement(
            "span",
            { key: filter.name, className: "filter-section" },
            React.createElement(
                "span",
                null,
                filter.name,
                " "
            ),
            nullable,
            input,
            delete_button
        );
    },
    createItem: function createItem(item) {
        var entity = g_InitialData.entities[this.state.data.entity];
        var identifier = "";
        entity.identifiers.forEach(function (ident) {
            identifier += item[ident];
        });
        return React.createElement(_item_row.ItemRow, { key: identifier, item: item, entity: entity, entityName: this.props.entity,
            editItem: this.editItem, actionItem: this.actionItem, itemCreate: this.itemCreate,
            refresh: this.refresh, mode: this.props.mode, showModal: this.props.showModal,
            columns: this.props.columns, moveHeader: this.props.moveHeader,
            sortFields: this.state.sortFields, filterFields: this.state.filterFields });
    },
    createPageButton: function createPageButton(page) {
        if (typeof page !== "number") {
            return React.createElement(
                "span",
                { key: page },
                "..."
            );
        }
        var classes = "btn btn-xs ";
        if (page === this.state.page) {
            classes += "btn-success";
        } else {
            classes += "btn-default";
        }
        return React.createElement(
            "button",
            { key: page, className: classes, onClick: this.handlePage.bind(this, page) },
            page + 1
        );
    },
    render: function render() {

        var data = this.state.data;
        if (data === null) {
            return React.createElement(
                "span",
                null,
                "Loading..."
            );
        }
        if (typeof data === "string") {
            return React.createElement(
                "span",
                null,
                data
            );
        }

        var entity = g_InitialData.entities[data.entity];
        if (entity === undefined) {
            return React.createElement(
                "span",
                null,
                "Error: cannot find entity description"
            );
        }

        if (entity.identifiers === undefined || entity.identifiers.length < 1) {
            return React.createElement(
                "span",
                null,
                "Error: cannot find entity identifiers"
            );
        }

        var associations = [];
        for (var type in entity.associations) {
            associations = associations.concat(entity.associations[type]);
        }

        var total_pages = Math.ceil(data.total_items / this.state.pageSize);

        var page_radius = 2;

        var page_list = [0];
        if (this.state.page - page_radius - 1 > 0) {
            page_list.push("<<");
        }
        for (var p = this.state.page - page_radius; p <= this.state.page + page_radius; p++) {
            if (p > 0 && p < total_pages - 1) {
                page_list.push(p);
            }
        }
        if (this.state.page + page_radius + 1 < total_pages) {
            page_list.push(">>");
        }
        if (total_pages > 1) {
            page_list.push(total_pages - 1);
        }

        var pageSizes = [5, 10, 20, 50, 100];
        for (var ps = 0; ps < pageSizes.length; ps++) {
            var size = pageSizes[ps];
            pageSizes[ps] = React.createElement(
                "option",
                { key: size, value: size },
                size
            );
        }

        if (this.state.loading) {
            var items = React.createElement(
                "div",
                { className: "data-row" },
                "Loading data..."
            );
        } else {
            var items = data.items.map(this.createItem);
        }

        var mode = null;
        if (this.props.mode !== undefined && this.props.mode.entity === this.props.entity) {
            var mode_label = this.props.mode.label;
            if (this.props.mode.mode === "multiselect") {
                mode_label += "(" + this.props.mode.value.length + ")";
            }
            mode = React.createElement(
                "div",
                { key: "mode", className: "data-cell data-header data-sm" },
                mode_label
            );
        }

        var this_ref = this;
        var entity_columns = this.props.columns[data.entity];
        var headers = [];
        entity.actions.forEach(function (action) {
            var order = entity_columns["_action_" + action.label];
            headers[order.index] = this_ref.createActionHeader(action.label, order.width);
        });
        associations.forEach(function (association) {
            var order = entity_columns[association.fieldName];
            headers[order.index] = this_ref.createAssociationHeader(association, order.width);
        });
        for (var fieldName in entity.fields) {
            var order = entity_columns[fieldName];
            headers[order.index] = this.createFieldHeader(fieldName, order.width);
        }

        if (g_InitialData.allow_fake_data_creation === true && this.props.mode === undefined) {
            var fake_data_button = React.createElement("button", { className: "btn btn-default btn-xs fa fa-exclamation-triangle", onClick: this.handleFakeData });
        }

        return React.createElement(
            "div",
            { className: "data-table", onMouseMove: this.handleMoveHeaderMove },
            React.createElement(
                "div",
                null,
                React.createElement(
                    "span",
                    { className: "data-table-controls" },
                    React.createElement(
                        "b",
                        null,
                        g_InitialData.entities[data.entity].name
                    ),
                    React.createElement("button", { className: "btn btn-default btn-xs fa fa-refresh", onClick: this.refresh }),
                    React.createElement("button", { className: "btn btn-default btn-xs fa fa-bar-chart", onClick: this.handleChart }),
                    React.createElement("button", { className: "btn btn-default btn-xs fa fa-calculator", onClick: this.handleStats }),
                    React.createElement("button", { className: "btn btn-default btn-xs fa fa fa-download", onClick: this.handleDownload }),
                    fake_data_button,
                    React.createElement("button", { className: "btn btn-default btn-xs fa fa-chevron-left", onClick: this.handlePage.bind(this, this.state.page - 1), disabled: this.state.page <= 0 }),
                    React.createElement("button", { className: "btn btn-default btn-xs fa fa-chevron-right", onClick: this.handlePage.bind(this, this.state.page + 1), disabled: this.state.page + 1 >= total_pages }),
                    " ",
                    React.createElement(
                        "span",
                        null,
                        " Page: ",
                        this.state.page + 1,
                        " / ",
                        total_pages,
                        " (",
                        React.createElement(
                            "b",
                            null,
                            data.total_items
                        ),
                        " items, ",
                        React.createElement(
                            "select",
                            { value: this.state.pageSize, onChange: this.handlePageSize },
                            pageSizes
                        ),
                        " per page) "
                    ),
                    page_list.map(this.createPageButton)
                ),
                this.state.filterFields.map(this.createFilterInput)
            ),
            React.createElement(
                "div",
                { className: "data-table-content" },
                React.createElement(
                    "div",
                    { className: "data-row" },
                    mode,
                    headers
                ),
                items
            )
        );
    }
}); /**
     * Created by Grigory on 14-Dec-16.
     */

},{"./item_row.jsx":3}]},{},[1]);
