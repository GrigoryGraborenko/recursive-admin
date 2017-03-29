/**
 * Created by Grigory on 14-Dec-16.
 */

import {ItemTable} from './item_table.jsx';

////////////////////////////////////////////////////////////////////////////////
// Chart Component
////////////////////////////////////////////////////////////////////////////////
var ChartContainer = React.createClass({
    render: function() {
        return <div/>;
    }
    ,componentDidMount: function() {
        this.node = ReactDOM.findDOMNode(this);

        this.canvas = $('<canvas id="modal-canvas" width="80%" height="400"></canvas>');
        $(this.node).append(this.canvas);

        //var is_time = (this.props.field.type === "date") || (this.props.field.type === "datetime");

        var labels = [];
        var data = [];
        this.props.data.forEach(function(point) {
            labels.push(point.value_of);
            data.push(parseInt(point.number_of));
        });

        this.chart = new Chart(this.canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: ('# of items grouped by ' + this.props.field.label),
                    data: data,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255,99,132,1)',
                    borderWidth: 1
                }]
            },
            options: {
                maintainAspectRatio: false
                //,responsive: false
                ,scales: {
                    yAxes: [{ ticks: { beginAtZero: true } }]
                }
            }
        });

        this.renderContent(this.props);
    }
    ,componentWillReceiveProps: function(new_props) {
        this.renderContent(new_props);
    }
    ,renderContent: function(props) {

        React.Component(<div>{props.children}</div>, this.node);
    }
    ,componentWillUnmount: function() {
        ReactDOM.unmountComponentAtNode(this.node);
        //this.chart.destroy();
    }
});

////////////////////////////////////////////////////////////////////////////////
// FieldInput Component
////////////////////////////////////////////////////////////////////////////////
var FieldInput = React.createClass({
    //getInitialState: function() {
    //    var state = {};
    //    // this.getDefaultFieldState(state, this.props.input);
    //    return { input: state };
    //}
    componentDidMount: function () {
        var state = {};
        if(this.props.state !== null) {
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
    ,getDefaultFieldState: function (state, input, existing) {
        for(var fieldName in input) {
            if(state[fieldName] !== undefined) {
                continue;
            }
            var field = input[fieldName];
            if(field.type === "select") {

                var selected_val = field.choices[0];
                if(field.default !== undefined) {
                    field.choices.forEach(function(choice) {
                        if(choice.value === field.default) {
                            selected_val = choice;
                        }
                    });
                }
                if(selected_val !== undefined) {
                    state[fieldName] = selected_val.value;
                    if(selected_val.input) {
                        this.getDefaultFieldState(state, selected_val.input);
                    }
                } else {
                    state[fieldName] = "";
                }

            } else if(field.default !== undefined) {
                if(((field.type === "date") || (field.type === "datetime"))) {
                    if(field.default === "") {
                        state[fieldName] = null;
                    } else if(field.default.date !== undefined) {
                        state[fieldName] = Math.floor((new Date(field.default.date + " UTC")).getTime() * 0.001);
                    } else {
                        state[fieldName] = (new Date(field.default)).getTime() * 0.001;
                    }
                } else {
                    state[fieldName] = field.default;
                }
            } else if(field.type === "boolean") {
                state[fieldName] = false;
            } else if(field.type === "entity") {
                state[fieldName] = {};
            } else if(field.type === "multientity") {
                state[fieldName] = [];
            } else if(((field.type === "date") || (field.type === "datetime"))) {
                state[fieldName] = null;
            } else if(field.type === "array") {
                state[fieldName] = [];
            } else if(field.type !== "info") { // goes last
                state[fieldName] = "";
            }
        }
    }
    ,onChange: function(field_name, field, sub_field, evnt) {

        var change = {};
        if(field.type === "boolean") {
            change[field_name] = (evnt.target.value === true) || (evnt.target.value === "true");
        } else if(field.type === "select") {
            change[field_name] = evnt.target.value;
            field.choices.forEach(function(choice) {
                if((choice.value === evnt.target.value) && (choice.input)) {
                    this.getDefaultFieldState(change, choice.input);
                }
            }, this);
        } else if(field.type === "entity") {
            change[field_name] = evnt;
        } else if((field.type === "date") || (field.type === "datetime")) {

            var current = this.props.state[field_name];
            var day_seconds = 86400;
            if (sub_field === "date") {
                if(evnt.target.value === "") {
                    change[field_name] = null;
                } else {
                    var new_date_time = Math.floor((new Date(evnt.target.value)).getTime() * 0.001);
                    change[field_name] = new_date_time + (current % day_seconds);
                }
            } else if (sub_field === "hour") {
                var days = Math.floor(current / day_seconds);
                change[field_name] = (days * day_seconds) + (parseInt(evnt.target.value) * 3600);
            } else if (sub_field === "minute") {
                var hours = Math.floor(current / 3600);
                change[field_name] = (hours * 3600) + (parseInt(evnt.target.value) * 60);
            } else if (sub_field === "second") {
                var minutes = Math.floor(current / 60);
                change[field_name] = (minutes * 60) + parseInt(evnt.target.value);
            }
        } else if(field.type === "multientity") {

            var select_all = !Array.isArray(this.props.state[field_name]);
            if(sub_field === "all") {
                if (select_all) {
                    change[field_name] = [];
                } else {
                    change[field_name] = { filters: evnt };
                }
            } else if(sub_field === "all.filters") {
                change[field_name] = { filters: evnt };
            } else if(!select_all) {
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
                if (this.props.state[field_name].length === new_selects.length) {
                    change[field_name].push(evnt);
                }
            }
        } else {
            change[field_name] = evnt.target.value;
        }
        // var input = $.extend({}, this.state.input, change);
        // this.setState({ input: input });
        var input = $.extend({}, this.props.state, change);
        this.props.onChange(input);
    }
    ,handleCopyClipboard: function(text, fieldname, field) {
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
    }
    ,handleFileChange: function(field_name, field, evnt) {
        var file = evnt.target.files[0];
        this.onChange(field_name, field, null, { target: { value: file }});
    }
    ,handleAddArray: function(field_name, field) {
        if(this.props.loading) {
            return;
        }
        var change = {};
        change[field_name] = this.props.state[field_name].concat([{}]);
        var input = $.extend({}, this.props.state, change);
        this.props.onChange(input);
    }
    ,handleDeleteArray: function(field_name, field, index) {
        if(this.props.loading) {
            return;
        }
        var new_arr = this.props.state[field_name].slice(0);
        new_arr.splice(index, 1);
        var change = {};
        change[field_name] = new_arr;
        var input = $.extend({}, this.props.state, change);
        this.props.onChange(input);
    }
    ,handleArrayChange: function(field_name, field, index, value) {
        if(this.props.loading) {
            return;
        }
        var new_arr = this.props.state[field_name].slice(0);
        new_arr[index] = value;
        var change = {};
        change[field_name] = new_arr;
        var input = $.extend({}, this.props.state, change);
        this.props.onChange(input);
    }
    ,createFieldInput: function(field_name, field, value) {

        var this_ref = this;
        var is_loading = this.props.loading;
        var inputs = [];
        if((field.type === "entity") || (field.type === "multientity")) {
            var mode = {
                mode: ((field.type === "multientity") ? "multiselect" : "select")
                ,label: "Select", entity: field.entity
                ,value: value
                ,onChange: this.onChange.bind(this, field_name, field, null)
                ,onSelectAll: function(filters, fixed) {
                    this_ref.onChange(field_name, field, (fixed === true) ? "all.filters" : "all", filters);
                }
            };
            var input = <ItemTable entity={field.entity} mode={mode} columns={this.props.columns} moveHeader={this.props.moveHeader} fixedFilter={field.filter} />;
        } else if(field.type === "info") {
            var text_lines = [];
            field.text.split("\n").forEach(function (para, index) {
                text_lines.push(<p key={index}>{para}</p>);
            });
            var input = <label>{text_lines}</label>;
        } else if(field.type === "boolean") {
            var input = <select className={"form-control"} id={field_name} onChange={this.onChange.bind(this, field_name, field, null)} value={value} disabled={is_loading}>
                <option value="true">True</option>
                <option value="false">False</option>
            </select>;
        } else if((field.type === "integer") || (field.type === "decimal")) {
            var input = <input type="number" className={"form-control"} id={field_name} onChange={this.onChange.bind(this, field_name, field, null)} value={value} disabled={is_loading}/>;
        } else if(field.type === "select") {
            var options = [];
            field.choices.forEach(function(op) {
                if(typeof(op) === "string") {
                    var op_val = op;
                    var op_label = op;
                } else {
                    var op_val = op.value;
                    var op_label = op.label;
                }
                options.push(<option key= {op_val} value={op_val}>{op_label}</option>);
                if((op.input !== undefined) && (op_val === value)) {
                    for(var fname in op.input) {
                        var val = this_ref.props.state[fname] !== undefined ? this_ref.props.state[fname] : (op.input[fname].default || "");
                        inputs = inputs.concat(this_ref.createFieldInput(fname, op.input[fname], val));
                    }
                }
            });
            var input = <select className={"form-control"} id={field_name} onChange={this.onChange.bind(this, field_name, field, null)} value={value} disabled={is_loading}>{options}</select>;
        } else if(field.type === "array") {
            inputs.push({field: { label: "", required: false }, field_name: field_name, input: (<b>{field.label}</b>)});
            value.forEach(function(val, index) {
                inputs.push({field: { required: false, label: "# " + index}, field_name: (field_name + index), input: (
                    <div>
                        <i className="fa fa-times action-icon" aria-hidden="true" onClick={this.handleDeleteArray.bind(this, field_name, field, index)}></i>
                        <FieldInput input={field.input} state={this.props.state[field_name][index]} loading={this.props.loading} onChange={this.handleArrayChange.bind(this, field_name, field, index)} columns={this.props.columns} moveHeader={this.props.moveHeader}/>
                    </div>
                )});
            }, this);
            inputs.push({field: { label: "Add", required: false }, field_name: field_name + "_add", input: (<i className="fa fa-plus action-icon" aria-hidden="true" onClick={this.handleAddArray.bind(this, field_name, field)}></i>)});
        } else if((field.type === "date") || (field.type === "datetime")) {
            if((value === null) || (value === "")) {
                var input = (
                    <span className="form-inline">
                        <input type="date" className={"form-control"} placeholder="yyyy-mm-dd" onChange={this.onChange.bind(this, field_name, field, "date")} value={""} disabled={is_loading}/>
                    </span>);
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
                    hours.push(<option key={i} value={i}>{(i < 10) ? "0" + i : i}</option>);
                }
                var minutes = [];
                for (var i = 0; i < 60; i++) {
                    minutes.push(<option key={i} value={i}>{(i < 10) ? "0" + i : i}</option>);
                }

                var input = (
                    <span className="form-inline">
                    <input type="date" className={"form-control"} placeholder="yyyy-mm-dd" onChange={this.onChange.bind(this, field_name, field, "date")} value={date_val}
                           disabled={is_loading}/>&nbsp;&nbsp;
                        <select className={"form-control"} onChange={this.onChange.bind(this, field_name, field, "hour")} value={hour} disabled={is_loading}>
                            {hours}
                        </select> :&nbsp;
                        <select className={"form-control"} onChange={this.onChange.bind(this, field_name, field, "minute")} value={minute} disabled={is_loading}>
                            {minutes}
                        </select> :&nbsp;
                        <select className={"form-control"} onChange={this.onChange.bind(this, field_name, field, "second")} value={second} disabled={is_loading}>
                            {minutes}
                        </select>
                </span>);
            }
        } else if(field.type === "clipboard") {
            var input = <span><button className={"btn btn-info"} onClick={this.handleCopyClipboard.bind(this, field.text, field_name, field)}>Copy to Clipboard</button> {value}</span>;
        } else if(field.type === "file") {
            var input = <form><input type="file" className={"modal-file-upload"} data-name={field_name} onChange={this.handleFileChange.bind(this, field_name, field)} /></form>;
        } else {
            //console.log("Unknown type " +  field.type);
            var input = <input type="text" className={"form-control"} id={field_name} onChange={this.onChange.bind(this, field_name, field, null)} value={value} disabled={is_loading}/>;
        }
        if(input !== undefined) {
            var input_obj = {field: field, field_name: field_name, input: input};
            inputs.unshift(input_obj);
        }
        return inputs;
    }
    ,createField: function(field_name) {
        var field = this.props.input[field_name];
        // var value = this.state.input[field_name];
        var value = this.props.state[field_name];

        if((field === undefined) || (value === undefined)) {
            //console.log("return NULL for " + field_name);
            return null;
        }

        var inputs = this.createFieldInput(field_name, field, value);
        var elements = [];
        inputs.forEach(function(input) {
            var required = input.field.required ? " *" : "";
            elements.push(
                <div key= {input.field_name} className="form-group">
                    <label for={input.field_name} className={"col-sm-2 control-label"}>{input.field.label}{required}</label>
                    <div className={"col-sm-10"}>
                        {input.input}
                    </div>
                </div>
            );
        });

        return elements;
    }
    ,render: function() {
        if(this.props.state === null) {
            return null;
        }
        var fields = this.props.input;
        return (
            <div>
                {Object.keys(fields).map(this.createField)}
            </div>
        );
    }
});

////////////////////////////////////////////////////////////////////////////////
// Input Modal
////////////////////////////////////////////////////////////////////////////////
export const InputModal = React.createClass({
    getInitialState: function() {
        return { input: null, loading: false, report: null, error_msg: null };
    }
    ,componentWillReceiveProps: function(props) {

        if((props.input === null) || (this.props.input !== null)) {
            return;
        }
        this.setState({ input: null, loading: false, report: null, error_msg: null });
    }
    ,onFieldChange: function(input) {
        this.setState({ input: input });
    }
    ,handleOK: function() {
        if(this.state.loading) {
            return;
        }

        if(this.props.input !== null) {
            for(var fieldName in this.props.input.input) {
                var field = this.props.input.input[fieldName];
                if((field.type === "entity") && (this.state.input[fieldName] === "")) {
                    this.setState({ error_msg: "Must select one " + fieldName });
                    return;
                }
                if(field.required && (this.state.input[fieldName] === "")) {
                    this.setState({ error_msg: "Must enter a value for '" + fieldName + "'" });
                    return;
                }
            }
        }

        this.setState({ loading: true });
        var this_ref = this;
        this.props.input.callback(this.state.input, function(success, err_msg) {
            if(success) {
                if(err_msg === undefined || (err_msg === null)) {
                    this_ref.props.hideModal();
                } else {
                    if(typeof(err_msg) === "string") {
                        var report = { type: "text", text: err_msg};
                    } else {
                        var report = err_msg;
                    }
                    this_ref.setState({ loading: false, report: report, error_msg: null });
                }
            } else {
                this_ref.setState({ loading: false, error_msg: err_msg });
            }
        });
    }
    ,render: function() {
        if(this.props.input === null) {
            return null;
        }

        var is_loading = this.state.loading;

        if(this.state.report !== null) {

            if(this.state.report.type === "text") {
                var report = [];
                this.state.report.text.split("\n").forEach(function (para, index) {
                    report.push(<p key={index}>{para}</p>);
                });
            } else if(this.state.report.type === "chart") {
                var report = <ChartContainer data={this.state.report.data} field={this.state.report.field} />;
            } else {
                var report = <span>Unknown report type</span>;
            }

            var contents =
                <div className={"row"}>
                    <h2>{this.props.input.heading}</h2>
                    <div className={"col-sm-12"}>{report}</div>
                    <div className={"col-sm-12"}>
                        <button className={"btn btn-success"} onClick={this.props.hideModal}>OK</button>
                    </div>
                </div>;
        } else {

            var error_report = null;
            if(this.state.error_msg !== null) {
                error_report = [];
                this.state.error_msg.split("\n").forEach(function (para, index) {
                    error_report.push(<p key={index}>{para}</p>);
                });
            }

            var contents =
                <div className={"row"}>
                    <h2>{this.props.input.heading}</h2>

                    <FieldInput input={this.props.input.input} state={this.state.input} loading={this.state.loading} onChange={this.onFieldChange} columns={this.props.columns} moveHeader={this.props.moveHeader}/>

                    <div className={"col-sm-offset-2"} style={{color: "red"}}>{error_report}</div>
                    <div className={"col-sm-offset-2"}>
                        <button className={"btn btn-success"} onClick={this.handleOK} disabled={is_loading}>OK</button>
                        <button className={"btn btn-danger"} onClick={this.props.hideModal} disabled={is_loading}>Cancel</button>
                    </div>
                </div>;
        }

        var outer_style = { position: "absolute", zIndex: 100, left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(128,128,128, 0.5)", pointerEvents: "auto"};
        var inner_style = { position: "absolute", left: "10%", right: "10%", top: "10%", bottom: "10%", backgroundColor: "rgba(255,255,255, 1.0)", overflowY: "scroll"};
        return  <div style={outer_style}>
            <div style={inner_style}>
                <div className={"container"} style={{ padding: "5px"}}>
                    <div className={"form-horizontal"} >
                        {contents}
                    </div>
                </div>
            </div>
        </div>;
    }
});