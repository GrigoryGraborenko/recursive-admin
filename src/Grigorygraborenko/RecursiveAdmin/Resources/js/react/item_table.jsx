/**
 * Created by Grigory on 14-Dec-16.
 */

import {ItemRow} from './item_row.jsx';

////////////////////////////////////////////////////////////////////////////////
// Item Table
////////////////////////////////////////////////////////////////////////////////
export const ItemTable = React.createClass({

    getInitialState: function() {

        var filter_fields = [];

        // gets fixed filters and initializes table with them
        var entity = g_InitialData.entities[this.props.entity];
        if(this.props.fixedFilter !== undefined) {
            for(var fieldName in this.props.fixedFilter) {
                var new_filter = this.getNewFilterObject(entity.fields[fieldName], this.props.fixedFilter[fieldName]);
                if(new_filter !== null) {
                    filter_fields.push(new_filter);
                }
            }
        }

        return { data: null, loading: 0, debounce: null, page: 0, pageSize: 10, sortFields: [], filterFields: filter_fields, dragField: null, dragPos: null };
    }
    ,componentDidMount: function() {
        this.refresh();
    }
    ,componentWillReceiveProps: function(props) {

        var values_identical = true;
        for(var name in props["associated-value"]) {
            if(props["associated-value"][name] !== this.props["associated-value"][name]) {
                values_identical = false;
                break;
            }
        }

        if( (props.entity === this.props.entity) &&
            (props["associated-field"] === this.props["associated-field"]) &&
            (props["associated-type"] === this.props["associated-type"]) &&
            values_identical) {
            return;
        }

        this.setState({ data: null });
        this.loadItemData(props, 0, 10, [], []);
    }
    ,refresh: function() {
        this.loadItemData(this.props, this.state.page, this.state.pageSize, this.state.sortFields, this.state.filterFields);
    }
    ,refreshItem: function(item) {

        var this_ref = this;
        var entity = g_InitialData.entities[this.state.data.entity];

        for(var i = 0; i < this.state.data.items.length; i++) {
            var old = this.state.data.items[i];

            var match = entity.identifiers.every(function(name) {
                return old[name] === item[name];
            });
            if(match) {
                var new_items = this.state.data.items.slice(0);
                new_items[i] = item;
                var new_data = $.extend({}, this_ref.state.data, {items: new_items});
                this_ref.setState({data: new_data});
                return;
            }
        }
    }
    ,refreshPageZero: function() {
        this.loadItemData(this.props, 0, this.state.pageSize, this.state.sortFields, this.state.filterFields);
    }
    ,loadItemData: function(props, page, page_size, sort_fields, filter_fields) {
        var loading_num = this.state.loading + 1;
        this.setState({ page: page, pageSize: page_size, loading: loading_num, sortFields: sort_fields, filterFields: filter_fields, dragField: null, dragPos: null });

        var send_data = {
            entity: props.entity
            ,page: page
            ,pageSize: page_size
            ,sort: sort_fields
            ,filter: filter_fields
            ,"associated-value": props["associated-value"]
            ,"associated-field": props["associated-field"]
            ,"associated-type": props["associated-type"]
        };

        var this_ref = this;
        var setData = function(data) {
            if(this_ref.state.loading === loading_num) {
                this_ref.setState({data: data, loading: 0});
            }
        };

        $.ajax({
            type: "POST"
            ,url: g_InitialData.data_route
            ,dataType: "json"
            ,data: send_data
        }).done(function(data) {
            setData(data);
        }).error(function(data) {
            if(data.responseJSON !== undefined) {
                setData(data.responseJSON.result);
            } else {
                setData("Unknown Error");
            }
        });
    }
    ,getNewFilterObject: function(field, fixed_value) {

        if(field === undefined) {
            return null;
        }

        var new_filter = { name: field.fieldName, type: field.type, value: "", immediate: false, fixed: (fixed_value !== undefined) };

        if(field.nullable) {
            new_filter.only_null = false;
            new_filter.immediate = true;
        }

        if(field.choices !== undefined) {
            new_filter.type = "choice";
            new_filter.choices = field.choices;
            new_filter.value = {};
            new_filter.choices.forEach(function(choice) {
                if(fixed_value !== undefined) {
                    new_filter.value[choice] = (fixed_value === choice) || (fixed_value.indexOf(choice) !== -1);
                } else {
                    new_filter.value[choice] = true;
                }
            });
            new_filter.immediate = true;
        } else if(field.type === "boolean") {
            new_filter.value = true;
            if(fixed_value !== undefined) {
                new_filter.value = (fixed_value === true) || (fixed_value === "true");
            }
            new_filter.immediate = true;
        } else if((field.type === "decimal") || (field.type === "integer")) {
            if(fixed_value !== undefined) {
                new_filter.value = fixed_value;
            } else {
                new_filter.value = { min: "", max: "" };
            }
        } else if((field.type === "date") || (field.type === "datetime")) {
            if(fixed_value !== undefined) {
                new_filter.value = fixed_value;
            } else {
                new_filter.value = { min: "", max: "" };
            }
        }

        return new_filter;
    }
    ,handleFilter: function(field) {

        var new_filter_fields = this.state.filterFields.slice(0);

        var found = false;
        $.each(new_filter_fields, function(index, filter_field) {
            if(filter_field.name === field.fieldName) {
                found = true;
                return false;
            }
        });

        if(found) {
            return;
        }

        var new_filter = this.getNewFilterObject(field);

        new_filter_fields.push(new_filter);
        if(new_filter.immediate) {
            this.loadItemData(this.props, 0, this.state.pageSize, this.state.sortFields, new_filter_fields);
        } else {
            this.setState({filterFields: new_filter_fields});
        }
    }
    ,handleFilterDelete: function(filter) {

        if(filter.fixed) {
            return;
        }

        var new_filter_fields = this.state.filterFields.slice(0);
        $.each(new_filter_fields, function(index, filter_field) {
            if(filter === filter_field) {
                new_filter_fields.splice(index, 1);
                return false;
            }
        });

        this.loadItemData(this.props, 0, this.state.pageSize, this.state.sortFields, new_filter_fields);
    }
    ,handleFilterChange: function(filter, debounce, sub_value, only_null, evnt) {

        if(filter.fixed) {
            return;
        }

        var this_ref = this;
        var new_filter_fields = this.state.filterFields.slice(0);
        $.each(new_filter_fields, function(index, filter_field) {
            if(filter === filter_field) {
                if(only_null) {
                    filter_field.only_null = evnt.target.value === "true";
                } else {
                    if(sub_value === null) {
                        filter_field.value = evnt.target.value;
                    } else {
                        filter_field.value[sub_value] = evnt.target.value;
                    }
                }

                if(debounce) {
                    clearTimeout(this_ref.state.debounce);
                    var newtimeout = setTimeout(this_ref.refreshPageZero, 500);
                    this_ref.setState({ filterFields: new_filter_fields, debounce: newtimeout });
                } else {
                    this_ref.loadItemData(this_ref.props, 0, this_ref.state.pageSize, this_ref.state.sortFields, new_filter_fields);
                }

                return false;
            }
        });
    }
    ,handleSort: function(fieldName, type) {

        var new_sort_fields = this.state.sortFields.slice(0);

        var found = false;
        $.each(new_sort_fields, function(index, sort_field) {
            if(sort_field.name === fieldName) {
                found = true;
                if(!sort_field.ascend) {
                    sort_field.ascend = true;
                } else {
                    new_sort_fields.splice(index, 1);
                }
                return false;
            }
        });

        if(found === false) {
            new_sort_fields.push({ name: fieldName, ascend: false, type: type });
        }

        this.loadItemData(this.props, this.state.page, this.state.pageSize, new_sort_fields, this.state.filterFields);
    }
    ,handlePage: function(page) {
        var total_pages = Math.ceil(this.state.data.total_items / this.state.pageSize);

        if((page < 0) || (page >= total_pages) || (page === this.state.page)) {
            return;
        }
        this.loadItemData(this.props, page, this.state.pageSize, this.state.sortFields, this.state.filterFields);
    }
    ,handlePageSize: function(evnt) {
        this.loadItemData(this.props, 0, evnt.target.value, this.state.sortFields, this.state.filterFields);
    }
    ,handleMoveHeaderClick: function(field_name, is_down, evnt) {
        if(is_down) {
            this.setState({ dragField: field_name, dragPos: evnt.clientX });
        } else {
            this.setState({ dragField: null, dragPos: null });
        }
    }
    ,handleMoveHeaderMove: function(evnt) {
        if(this.state.dragField === null) {
            return;
        }
        if(evnt.buttons === 0) {
            this.setState({ dragField: null, dragPos: null });
            return;
        }
        var diff = evnt.clientX - this.state.dragPos;
        this.setState({ dragPos: evnt.clientX });
        this.props.moveHeader(this.props.entity, this.state.dragField, diff);
        evnt.preventDefault();
        evnt.stopPropagation();
    }
    ,handleCreate: function() {
        this.itemCreate(this.props.entity);
    }
    ,handleDestroy: function() {

        var this_ref = this;
        var send_data = { entity: this.props.entity };
        var target_entity = g_InitialData.entities[this.props.entity];
        var controls = {
            instances: { type: "multientity", entity: this.props.entity, label: "Select instances to delete" }
            ,info: { type: "info", label: "", text: "This will delete these instances. " }
            ,sure: { type: "boolean", label: "Are you sure?" } };
        this.props.showModal("Delete instances of " + target_entity.label, controls, function(input, callback) {
            if(input.sure !== true) {
                callback(false, "Cannot delete unless you are sure");
                return;
            }
            send_data.ids = input.instances;

            $.ajax({
                type: "POST"
                ,url: g_InitialData.destroy_route
                ,dataType: "json"
                ,data: send_data
            }).done(function(data) {
                callback(true, "Successfully destroyed " + data.count + " entities");
                this_ref.refresh();
            }).error(function(data) {
                if(data.responseJSON !== undefined) {
                    callback(false, data.responseJSON.result);
                } else {
                    callback(false, "Unknown Error");
                }
            });
        });
    }
    ,handleChart: function() {

        var choices = [];

        var entity = g_InitialData.entities[this.props.entity];
        for(var fieldName in entity.fields) {
            var field = entity.fields[fieldName];
            if((field.type === "date") || (field.type === "datetime") || (field.type === "integer") || (field.type === "decimal")) {
                choices.push({ value: fieldName, label: field.label });
            }
        }
        if(choices.length < 0) {
            return;
        }
        var controls = { attribute: { type: "select", choices: choices, label: "Attribute to graph" } };

        var send_data = {
            entity: this.props.entity
            ,filter: this.state.filterFields
            ,"associated-value": this.props["associated-value"]
            ,"associated-field": this.props["associated-field"]
            ,"associated-type": this.props["associated-type"]
        };

        this.props.showModal("Graph attributes for " + entity.label, controls, function(input, callback) {

            send_data.groupBy = input.attribute;

            $.ajax({
                type: "POST"
                ,url: g_InitialData.graph_route
                ,dataType: "json"
                ,data: send_data
            }).done(function(data) {
                callback(true, { type: "chart", data: data, field: entity.fields[input.attribute] });
            }).error(function(data) {
                if(data.responseJSON !== undefined) {
                    callback(false, data.responseJSON.result);
                } else {
                    callback(false, "Unknown Error");
                }
            });
        });
    }
    ,handleStats: function() {

        var choices = [];

        var entity = g_InitialData.entities[this.props.entity];
        for(var fieldName in entity.fields) {
            var field = entity.fields[fieldName];
            if((field.type === "integer") || (field.type === "decimal")) {
                choices.push({ value: fieldName, label: field.label });
            }
        }
        if(choices.length < 0) {
            return;
        }
        var controls = { attribute: { type: "select", choices: choices, label: "Attribute to get stats for" } };

        var send_data = {
            entity: this.props.entity
            ,filter: this.state.filterFields
            ,"associated-value": this.props["associated-value"]
            ,"associated-field": this.props["associated-field"]
            ,"associated-type": this.props["associated-type"]
        };

        this.props.showModal("Stats for " + entity.label, controls, function(input, callback) {

            send_data.groupBy = input.attribute;

            $.ajax({
                type: "POST"
                ,url: g_InitialData.stats_route
                ,dataType: "json"
                ,data: send_data
            }).done(function(data) {
                var total = parseFloat(data.stats_count);
                var sum = parseFloat(data.stats_sum);
                var sum_squares = parseFloat(data.stats_sum_squares);
                var mean = sum / total;
                var std_dev = (sum_squares / total) - (mean * mean);
                if(std_dev > 0.000001) {
                    std_dev = Math.sqrt(std_dev);
                } else {
                    std_dev = 0;
                }
                var msg =   "Min: " + data.stats_min + "\n" +
                    "Max: " + data.stats_max + "\n" +
                    "Sum: " + sum + "\n" +
                    "Mean: " + mean + "\n" +
                    "Standard Deviation: " + std_dev + "\n" +
                    "Total: " + total + "\n";
                callback(true, msg);
            }).error(function(data) {
                if(data.responseJSON !== undefined) {
                    callback(false, data.responseJSON.result);
                } else {
                    callback(false, "Unknown Error");
                }
            });
        });

    }
    ,handleDownload: function() {

        var send_data = {
            entity: this.props.entity
            ,filter: this.state.filterFields
            ,"associated-value": this.props["associated-value"]
            ,"associated-field": this.props["associated-field"]
            ,"associated-type": this.props["associated-type"]
        };

        var url_data = $.param(send_data);

        this.props.showModal("Download table results", {}, function(input, callback) {
            window.location = g_InitialData.export_route + "?" + url_data;
            callback(true);
        });

    }
    ,handleFakeData: function () {
        var controls = {
            "amount": { type: "integer", label: "Number of rows to add to this table", default: 0 }
            ,"sure": { type: "boolean", label: "Are you sure?", default: false }
        };
        var this_ref = this;
        this.props.showModal("Fill this table full of fake data", controls, function(input, callback) {
            if(input.sure !== true) {
                callback(false, "Confirm you are sure about adding fake data to the table");
                return;
            }

            $.ajax({
                type: "POST"
                ,url: g_InitialData.fake_data_route
                ,dataType: "json"
                ,data: {
                    entity: this_ref.props.entity
                    ,amount: input.amount
                }
            }).done(function(data) {
                callback(true);
                this_ref.refresh();

            }).error(function(data) {
                if(data.responseJSON !== undefined) {
                    callback(false, data.responseJSON.result);
                } else {
                    callback(false, "Unknown Error");
                }
            });
        });
    }
    ,doesFieldAffectOrder: function(fieldName) {
        var affects = this.state.sortFields.some(function(sort) {
            return sort.name === fieldName;
        });
        if(affects) return true;
        return this.state.filterFields.some(function(filter) {
            return filter.name === fieldName;
        });
    }
    ,editItem(identifiers, field, value, callback) {
        if(this.state.loading) {
            return;
        }

        var this_ref = this;
        $.ajax({
            type: "POST"
            ,url: g_InitialData.edit_route
            ,contentType: "application/json"
            ,data: JSON.stringify({ entity: this_ref.props.entity, identifiers: identifiers, field: field, value: value })
        }).done(function(data) {

            var edit_index = null;
            $.each(this_ref.state.data.items, function(index, item) {
                for(var id_name in identifiers) {
                    if(item[id_name] !== identifiers[id_name]) {
                        return;
                    }
                }

                edit_index = index;
                return false;
            });
            if(edit_index === null) {
                return;
            }
            var new_data = $.extend({}, this_ref.state.data);
            new_data.items = new_data.items.slice(0);
            new_data.items[edit_index] = data.item;

            this_ref.setState({ data: new_data });
            if(callback !== undefined) {
                callback(true);
            }
        }).error(function(data) {
            if(callback !== undefined) {
                callback(false, data.responseJSON.result);
            }
        });

    }
    ,actionItem: function(identifiers, action) {
        if(this.state.loading) {
            return;
        }

        var this_ref = this;
        var ajax_call = function(input, callback) {

            $.ajax({
                type: "POST"
                ,url: g_InitialData.action_route
                ,dataType: "json"
                ,data: { entity: this_ref.props.entity, identifiers: identifiers, name: action.name, input: input }
            }).done(function(data) {

                if(callback !== undefined) {
                    callback(true, null);
                }
                // if true is returned, will always refresh
                if(data.affected_fields === true) {
                    this_ref.refresh();
                    return;
                }
                if(data.affected_fields === undefined) {
                    var order_affected = false;
                } else {
                    var order_affected = data.affected_fields.some(function (field_name) {
                        return this_ref.doesFieldAffectOrder(field_name);
                    });
                }

                if(order_affected) {
                    this_ref.refresh();
                } else {
                    this_ref.refreshItem(data.item);
                }
            }).error(function(data) {
                if(callback !== undefined) {
                    callback(false, (data.responseJSON === undefined) ? "Unknown Error" : data.responseJSON.result);
                }
            });
        };

        if(action.input !== null) {
            this.props.showModal(action.description, action.input, ajax_call);
        } else {
            ajax_call();
        }

    }
    ,itemCreate: function(entity, preselected) {

        var this_ref = this;
        var target = g_InitialData.entities[entity];

        var controls = {};

        if(target.creation === undefined) {
            for (var field_name in target.fields) {
                var field = target.fields[field_name];
                if (field.id || ((!field.editable) && (field.nullable)) || ((preselected !== undefined) && (preselected[field_name] !== undefined))) {
                    continue;
                }
                controls[field_name] = {label: field_name, type: field.type, required: (field.editable && (!field.nullable))};
            }
        } else {
            controls = target.creation;
        }

        var assoc_fields = target.associations.many_one.concat(target.associations.one_one);
        assoc_fields.forEach(function(assoc_field) {
            if((preselected !== undefined) && (preselected[assoc_field.fieldName] !== undefined)) {
                var ctrl = {
                    type: "info"
                    ,text: JSON.stringify(preselected[assoc_field.fieldName])
                };
                ctrl.label = assoc_field.fieldName;
                controls[assoc_field.fieldName] = ctrl;
            }
            /*else {
                return;
                var ctrl = {
                    type: "entity"
                    ,entity: assoc_field.targetEntity
                };
            }
            ctrl.label = assoc_field.fieldName;
            controls[assoc_field.fieldName] = ctrl;
            */
        });

        this.props.showModal("Create new " + target.name, controls, function(input, callback) {

            if(preselected !== undefined) {
                for(var propname in preselected) {
                    input[propname] = preselected[propname];
                }
            }

            $.ajax({
                type: "POST"
                ,url: g_InitialData.create_route
                ,dataType: "json"
                ,data: { entity: entity, input: input }
            }).done(function(data) {

                if(callback !== undefined) {
                    callback(true, null);
                }
                this_ref.refresh();
            }).error(function(data) {
                if(callback !== undefined) {
                    callback(false, (data.responseJSON === undefined) ? "Unknown Error" : data.responseJSON.result);
                }
            });
        });
    }
    ,createResize: function(fieldname) {
        return <i   className={"fa fa-arrows-h action-icon pull-right"} style={{position: "relative"}} aria-hidden="true"
                    onMouseDown={this.handleMoveHeaderClick.bind(this, fieldname, true)}
                    onMouseUp={this.handleMoveHeaderClick.bind(this, fieldname, false)}></i>;
    }
    ,createSortTemplate: function(field_name, type) {
        // var sort_template = null;
        var multi_sort = this.state.sortFields.length > 1;

        var inner_text = "";
        var icon_class = "fa fa-sort action-icon";
        $.each(this.state.sortFields, function(index, sort_field) {
            if(field_name === sort_field.name) {
                icon_class = sort_field.ascend ? "fa fa-caret-down action-icon": "fa fa-caret-up action-icon";
                inner_text = multi_sort ? ("(" + (index + 1) + ") ") : "";
                return false;
            }
        });
        return <i className={icon_class} aria-hidden="true" onClick={this.handleSort.bind(this, field_name, type)}>{inner_text}</i>;
    }
    ,createActionHeader: function(action, width) {
        if(this.props.mode !== undefined) {
            return null;
        }
        return <div key={"action_" + action} className={"data-cell data-header data-sm"} style={{ width: width }}>{this.createResize("_action_" + action)}{action}</div>
    }
    ,createAssociationHeader: function(assoc, width) {
        return  <div key={"association_" + assoc.fieldName} title={assoc.fieldName} className={"data-cell data-header data-sm"} style={{ width: width }}  >
            {this.createResize(assoc.fieldName)}
            {this.createSortTemplate(assoc.fieldName, assoc.type_name)}
            {assoc.label}
        </div>;
    }
    ,createFieldHeader: function(field_name, width) {
        var entity = g_InitialData.entities[this.state.data.entity];
        var field = entity.fields[field_name];

        return  <div key={"field_" + field_name} title={field_name} className={"data-cell data-header"} style={{ width: width }} >
            {this.createResize(field_name)}
            <i className={"fa fa-filter action-icon"} aria-hidden="true" onClick={this.handleFilter.bind(this, field)}></i>
            {this.createSortTemplate(field_name, "field")}
            {field.label}
        </div>;
    }
    ,createFilterInput: function(filter) {
        var this_ref = this;
        if(filter.choices !== undefined) {

            var createChoice = function(choice) {
                return (
                    <span key={choice}>
                        <input type="checkbox" checked={filter.value[choice]} disabled={filter.fixed} onChange={this_ref.handleFilterChange.bind(this_ref, filter, false, choice, false, { target: { value: (!filter.value[choice])}} )} />
                        <label>&nbsp;{choice}&nbsp;&nbsp;</label>
                    </span>);
            };
            var input = filter.choices.map(createChoice);
        } else if(filter.type === "boolean") {
            var input = <select disabled={filter.fixed} onChange={this.handleFilterChange.bind(this, filter, false, null, false)} value={filter.value} >
                <option value="true">True</option>
                <option value="false">False</option>
            </select>;
        } else if((filter.type === "integer") || (filter.type === "decimal")) {
            var input = <span>
                            <input type="number" value={filter.value.min} disabled={filter.fixed} onChange={this.handleFilterChange.bind(this, filter, true, "min", false)} />
                            <span> to </span>
                            <input type="number" value={filter.value.max} disabled={filter.fixed} onChange={this.handleFilterChange.bind(this, filter, true, "max", false)} />
                        </span>;
        } else if((filter.type === "date") || (filter.type === "datetime")) {
            var input = <span>
                            <input type="date" value={filter.value.min} disabled={filter.fixed} onChange={this.handleFilterChange.bind(this, filter, true, "min", false)} placeholder="yyyy-mm-dd"/>
                            <span> to </span>
                            <input type="date" value={filter.value.max} disabled={filter.fixed} onChange={this.handleFilterChange.bind(this, filter, true, "max", false)} placeholder="yyyy-mm-dd"/>
                        </span>;
        } else {
            var input = <input type="text" value={filter.value} disabled={filter.fixed} onChange={this.handleFilterChange.bind(this, filter, true, null, false)} />;
        }

        if(filter.only_null === undefined) {
            var nullable = null;
        } else {
            var nullable =  <select value={filter.only_null} disabled={filter.fixed} onChange={this.handleFilterChange.bind(this, filter, false, null, true)}>
                <option value="false">Not Null</option>
                <option value="true">Null</option>
            </select>;
            if(filter.only_null) {
                input = null;
            }
        }
        if(filter.fixed) {
            var delete_button = null;
        } else {
            var delete_button = <i className={"fa fa-times action-icon"} aria-hidden="true" onClick={this.handleFilterDelete.bind(this, filter)}></i>;
        }

        return  <span key={filter.name} className={"filter-section"}>
                    <span>{filter.name} </span>{ nullable }{ input }{ delete_button }
                </span>
    }
    ,createItem: function(item) {
        var entity = g_InitialData.entities[this.state.data.entity];
        var identifier = "";
        entity.identifiers.forEach(function(ident) {
            identifier += item[ident];
        });
        return <ItemRow key={identifier} item={item} entity={entity} entityName={this.props.entity}
                        editItem={this.editItem} actionItem={this.actionItem} itemCreate={this.itemCreate}
                        refresh={this.refresh} mode={this.props.mode} showModal={this.props.showModal}
                        columns={this.props.columns} moveHeader={this.props.moveHeader}
                        sortFields={this.state.sortFields} filterFields={this.state.filterFields} />;
    }
    ,createPageButton: function(page) {
        if(typeof(page) !== "number") {
            return <span key={page}>...</span>;
        }
        var classes = "btn btn-xs ";
        if(page === this.state.page) {
            classes += "btn-success";
        } else {
            classes += "btn-default";
        }
        return <button key={page} className={classes} onClick={this.handlePage.bind(this, page)} >{page + 1}</button>
    }
    ,render: function() {

        var data = this.state.data;
        if(data === null) {
            return <span>Loading...</span>;
        }
        if(typeof(data) === "string") {
            return <span>{data}</span>;
        }

        var entity = g_InitialData.entities[data.entity];
        if(entity === undefined) {
            return <span>Error: cannot find entity description</span>;
        }

        if((entity.identifiers === undefined) || (entity.identifiers.length < 1)) {
            return <span>Error: cannot find entity identifiers</span>;
        }

        var associations = [];
        for(var type in entity.associations) {
            associations = associations.concat(entity.associations[type]);
        }

        var total_pages = Math.ceil(data.total_items / this.state.pageSize);

        var page_radius = 2;

        var page_list = [0];
        if((this.state.page - page_radius - 1) > 0) {
            page_list.push("<<");
        }
        for(var p = (this.state.page - page_radius); p <= (this.state.page + page_radius); p++) {
            if((p > 0) && (p < (total_pages - 1))) {
                page_list.push(p);
            }
        }
        if((this.state.page + page_radius + 1) < total_pages) {
            page_list.push(">>");
        }
        if(total_pages > 1) {
            page_list.push(total_pages - 1);
        }

        var pageSizes = [5, 10, 20, 50, 100];
        for(var ps = 0; ps < pageSizes.length; ps++) {
            var size = pageSizes[ps];
            pageSizes[ps] = <option key={size} value={size}>{size}</option>;
        }

        if(this.state.loading) {
            var items = <div className={"data-row"}>Loading data...</div>;
        } else {
            var items = data.items.map(this.createItem);
        }

        var mode = null;
        if((this.props.mode !== undefined) && (this.props.mode.entity === this.props.entity)) {
            var mode_label = this.props.mode.label;
            if(this.props.mode.mode === "multiselect") {
                mode_label += "(" + this.props.mode.value.length + ")";
            }
            mode = <div key="mode" className={"data-cell data-header data-sm"}>{mode_label}</div>;
        }

        var this_ref = this;
        var entity_columns = this.props.columns[data.entity];
        var headers = [];
        entity.actions.forEach(function(action) {
            var order = entity_columns["_action_" + action.label];
            headers[order.index] = this_ref.createActionHeader(action.label, order.width);
        });
        associations.forEach(function(association) {
            var order = entity_columns[association.fieldName];
            headers[order.index] = this_ref.createAssociationHeader(association, order.width);
        });
        for(var fieldName in entity.fields) {
            var order = entity_columns[fieldName];
            headers[order.index] = this.createFieldHeader(fieldName, order.width);
        }

        if(this.props.mode === undefined) {
            if(g_InitialData.allow_fake_data_creation === true) {
                var fake_data_button = <button className={"btn btn-default btn-xs fa fa-exclamation-triangle"} onClick={this.handleFakeData}></button>;
            }
            if(entity.can_create === true) {
                var create_button = <button className={"btn btn-primary btn-xs fa fa-plus"} onClick={this.handleCreate}></button>;
            }
            if(entity.can_destroy === true) {
                var destroy_button = <button className={"btn btn-danger btn-xs fa fa-minus"} onClick={this.handleDestroy}></button>;
            }
            var luxury_buttons = <span>
                <button className={"btn btn-default btn-xs fa fa-bar-chart"} onClick={this.handleChart}></button>
                <button className={"btn btn-default btn-xs fa fa-calculator"} onClick={this.handleStats}></button>
                <button className={"btn btn-default btn-xs fa fa fa-download"} onClick={this.handleDownload}></button>
                {fake_data_button}
            </span>;
        }

        return  <div className={"data-table"} onMouseMove={this.handleMoveHeaderMove}>
            <div>
                        <span className={"data-table-controls"}>
                        {create_button}
                        {destroy_button}
                        <b>{g_InitialData.entities[data.entity].name}</b>
                        <button className={"btn btn-default btn-xs fa fa-refresh"} onClick={this.refresh} ></button>
                        {luxury_buttons}
                        <button className={"btn btn-default btn-xs fa fa-chevron-left"} onClick={this.handlePage.bind(this, this.state.page - 1)} disabled={this.state.page <= 0}></button>
                        <button className={"btn btn-default btn-xs fa fa-chevron-right"} onClick={this.handlePage.bind(this, this.state.page + 1)} disabled={(this.state.page + 1) >= total_pages}></button>&nbsp;
                            <span> Page: {this.state.page + 1} / {total_pages} (<b>{data.total_items}</b> items, <select value={this.state.pageSize} onChange={this.handlePageSize}>{pageSizes}</select> per page) </span>
                            {page_list.map(this.createPageButton)}
                        </span>
                {this.state.filterFields.map(this.createFilterInput)}
            </div>
            <div className={"data-table-content"}>
                <div className={"data-row"}>
                    {mode}
                    {headers}
                </div>
                {items}
            </div>
        </div>;
    }
});