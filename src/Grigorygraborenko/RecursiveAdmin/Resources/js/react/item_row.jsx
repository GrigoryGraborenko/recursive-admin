/**
 * Created by Grigory on 14-Dec-16.
 */

import {ItemTable} from './item_table.jsx';

////////////////////////////////////////////////////////////////////////////////
// Item Row
////////////////////////////////////////////////////////////////////////////////
export const ItemRow = React.createClass({
    getInitialState: function() {
        return { expand: null };
    }
    ,getIdentifiers: function() {
        var identifier = {};
        var this_ref = this;
        this.props.entity.identifiers.forEach(function(id_name) {
            identifier[id_name] = this_ref.props.item[id_name];
        });
        return identifier;
    }
    ,handleExpand: function(association) {
        if((this.state.expand !== null) && (this.state.expand.fieldName === association.fieldName)) {
            var new_expand = null;
        } else {
            var new_expand = association;
        }
        this.setState({ expand: new_expand });
    }
    ,handleEdit: function(field) {
        var value = this.props.item[field.fieldName];
        var is_null = (value === null);

        var controls = {};
        var val_ctrl = { type: field.type, label: field.label, default: (is_null ? "" : value)};
        if(field.choices !== undefined) {
            val_ctrl.type = "select";
            val_ctrl.choices = field.choices;
        }
        if(field.nullable === true) {
            controls['is_null'] = { type: "select", label: "Set to empty?", default: "false", choices: [
                { value: "true", label: "Empty" }
                ,{ value: "false", label: "Not Empty", input: {
                    value: val_ctrl
                }}
            ]};
        } else {
            controls['value'] = val_ctrl;
        }
        //controls['value'] = { type: field.type, label: field.label, default: (is_null ? "" : value)};

        var this_ref = this;
        this.props.showModal("Edit " + field.label, controls, function(input, callback) {
            var send_value = input.is_null === "true" ? null : input.value;
            this_ref.props.editItem(this_ref.getIdentifiers(), field.fieldName, send_value, function(success, err_msg) {
                callback(success, err_msg);
            });
        });
    }
    ,handleAction: function(action) {
        this.props.actionItem(this.getIdentifiers(), action);
    }
    ,handleCreate: function(assoc) {

        var preselected = {};
        if(assoc.mappedBy !== undefined) {
            preselected[assoc.mappedBy] = this.getIdentifiers();
        }
        this.props.itemCreate(assoc.targetEntity, preselected);
    }
    ,createAction: function(action) {

        var classes = "btn btn-xs ";
        if(action.class !== undefined) {
            classes += action.class;
        }

        if(action.input === undefined) {
            return <span key={action.name} className={classes}>{action.label}</span>;
        }

        return <button key={action.name} className={classes} onClick={this.handleAction.bind(this, action)}>{action.label}</button>;
    }
    ,createActionGroup: function(action_heading, width, classes) {
        if(this.props.mode !== undefined) {
            return null;
        }

        var actions = [];
        this.props.item._ACTIONS.forEach(function(action) {
            if(action.heading === action_heading) {
                actions.push(action);
            }
        });
        return <div key={action_heading} className={"data-cell data-sm" + classes} style={{ width: width }} >{actions.map(this.createAction)}</div>;
    }
    ,createAssociation: function(association, width, classes) {
        if((this.state.expand !== null) && (this.state.expand.fieldName === association.fieldName)) {
            return <div key={association.fieldName} className={"data-cell data-sm"} style={{ width: width }} ><button className={"btn btn-xs btn-warning"} onClick={this.handleExpand.bind(this, association)}>Collapse</button></div>;
        }

        var assoc_field = this.props.item[association.fieldName];
        if(assoc_field === null) {
            return <div key={association.fieldName} className={"data-cell data-sm"} style={{ width: width }}>NULL</div>;
        }

        var expansion = null;
        if(association.expand_permission) {
            var expand_text = " + ";
            if(assoc_field !== undefined) {
                if(assoc_field.preview !== undefined) {
                    expand_text += assoc_field.preview;
                } else if(assoc_field.count !== undefined) {
                    expand_text += assoc_field.count;
                }
            }

            expansion = <button className={"btn btn-xs"} onClick={this.handleExpand.bind(this, association)}>
                {expand_text}
            </button>;
        } else {
            var expand_text = (assoc_field.count !== undefined) ? assoc_field.count : "1 Item";
            expansion = <span>{expand_text}</span>;
        }

        var create_temp = null;
        if(association.create_permission && (this.props.mode === undefined)) {
            create_temp = <i className={"fa fa-plus action-icon"} aria-hidden="true" onClick={this.handleCreate.bind(this, association)}></i>;
        }

        return  <div key={association.fieldName} className={"data-cell data-sm" + classes} title={expand_text}  style={{ width: width }}>
            {create_temp}
            {expansion}
        </div>;
    }
    ,createField: function(field_name, width, classes) {
        var field = this.props.entity.fields[field_name];
        // var editable = (field.id !== true) && (field.editable) && ((field.type === "string") || (field.type === "text") || (field.type === "boolean") || (field.type === "integer") || (field.type === "decimal"));
        var editable = (field.id !== true) && (field.editable) && ((field.type === "string") || (field.type === "text") || (field.type === "boolean") || (field.type === "integer") || (field.type === "decimal") || (field.type === "date") || (field.type === "datetime"));
        editable = editable && (this.props.mode === undefined);

        var value = this.props.item[field_name];

        var text = value;
        if(value === undefined) {
            text = "---";
        } else if(value === null) {
            text = "NULL";
        } else if((field.type === "datetime") || (field.type === "date")) {
            text = value.date;
        }
        text += "";

        var edit_markup = null;
        if(editable) {
            edit_markup = <i className={"fa fa-pencil action-icon"} aria-hidden="true" onClick={this.handleEdit.bind(this, field)}></i>;
        }
        return <div key={field_name} title={text} className={"data-cell" + classes} style={{ width: width }} >{edit_markup}{text}</div>;
    }
    ,createExpansion: function() {

        var assoc = this.state.expand;

        // var assoc_field = null;
        if((assoc.type_name === "many_one") || (assoc.type_name === "one_one")) {

            if(this.props.item[assoc.fieldName] === undefined) {
                return <div className={"data-row data-expansion"}>Field name not found</div>
            }

            var identifier = this.props.item[assoc.fieldName].identifiers;
        } else {
            if((assoc.mappedBy === undefined) && (assoc.inversedBy === undefined)) {
                return <div className={"data-row data-expansion"}>One-to-many and many-to-many associations need to have 'mappedBy' or 'inversedBy'</div>
            }

            if(assoc.mappedBy !== undefined) {
                var assoc_field = assoc.mappedBy;
            } else {
                var assoc_field = assoc.inversedBy;
            }
            var identifier = this.getIdentifiers();
        }

        return  <div className={"data-row data-expansion"}>
            <ItemTable entity={assoc.targetEntity} associated-value={identifier} associated-field={assoc_field} associated-type={assoc.type_name} mode={this.props.mode} showModal={this.props.showModal} columns={this.props.columns} moveHeader={this.props.moveHeader}/>
        </div>;
    }
    ,render: function() {

        var associations = [];
        for(var type in this.props.entity.associations) {
            associations = associations.concat(this.props.entity.associations[type]);
        }

        var mode = null;
        if((this.props.mode !== undefined) && (this.props.mode.onChange !== undefined) && (this.props.mode.entity === this.props.entityName)) {
            var ids = this.getIdentifiers();

            var multi = this.props.mode.mode === "multiselect";
            if(multi) {
                var potentials = this.props.mode.value;
            } else {
                var potentials = [this.props.mode.value];
            }

            var is_selected = potentials.some(function(select) {
                var selected = true;
                for(var propname in ids) {
                    if(ids[propname] !== select[propname]) {
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
            if(multi) {
                var select_ctrl = <span onClick={this.props.mode.onChange.bind(this, ids)} ><input type="checkbox" checked={is_selected} readOnly />{(is_selected ? "Selected" : "Select")}</span>;
            } else {
                if(is_selected) {
                    var button_text = "Selected";
                    var button_classes = "btn btn-success btn-xs";
                } else {
                    var button_text = "Select";
                    var button_classes = "btn btn-info btn-xs";
                }
                var select_ctrl = <button className={button_classes} onClick={this.props.mode.onChange.bind(this, ids)}>{button_text}</button>;
            }

            mode =  <div className={"data-cell data-sm" + (is_selected ? " selected" : "")} title="Select">
                {select_ctrl}
            </div>;
        }

        // sorts the columns, specifies their widths and classes
        var this_ref = this;
        var column_funcs = [];
        this.props.entity.actions.forEach(function(action) {
            column_funcs.push({ func: this_ref.createActionGroup, arg: action.label, order: ("_action_" + action.label) });
        });
        associations.forEach(function(association) {
            column_funcs.push({ func: this_ref.createAssociation, arg: association, order: association.fieldName });
        });
        for(var fieldName in this.props.entity.fields) {
            column_funcs.push({ func: this_ref.createField, arg: fieldName, order: fieldName });
        }

        var entity_columns = this.props.columns[this.props.entityName];
        var columns = [];
        column_funcs.forEach(function(col_func) {

            var sorted = this_ref.props.sortFields.some(function(sort) {
                return (col_func.order === sort.name);
            });
            var filtered = this_ref.props.filterFields.some(function(filter) {
                return (col_func.order === filter.name);
            });
            var col_classes = " ";
            if(sorted) {
                col_classes += "sorted";
            }
            if(filtered) {
                col_classes += "filtered";
            }

            var order = entity_columns[col_func.order];
            columns[order.index] = col_func.func(col_func.arg, order.width, col_classes);
        });

        var data_row =  <div className={"data-row"}>
            {mode}
            {columns}
        </div>;

        if(this.state.expand === null) {
            return data_row;
        }

        return  <div>
            { data_row }
            { this.createExpansion() }
        </div>;
    }
});