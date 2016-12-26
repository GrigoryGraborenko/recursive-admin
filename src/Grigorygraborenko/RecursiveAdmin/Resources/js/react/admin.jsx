
import {ItemTable} from './item_table.jsx';
import {InputModal} from './input_modal.jsx';

////////////////////////////////////////////////////////////////////////////////
// Input Modal
////////////////////////////////////////////////////////////////////////////////
var AdminContainer = React.createClass({
    getInitialState: function() {

        var default_width = 120;

        var columns = {};
        for(var name in g_InitialData.entities) {
            var entity = g_InitialData.entities[name];

            var column = {};
            var column_index = 0;

            var associations = [];
            for(var type in entity.associations) {
                associations = associations.concat(entity.associations[type]);
            }

            var column_list = [];
            entity.actions.forEach(function(action) {
                column_list.push({ index: column_index++, width: default_width, name: ("_action_" + action.label), priority: action.priority, sub_priority: 2 });
            });
            associations.forEach(function(assoc) {
                column_list.push({ index: column_index++, width: default_width, name: assoc.fieldName, priority: assoc.priority, sub_priority: 1 });
            });
            for(var fieldName in entity.fields) {
                column_list.push({ index: column_index++, width: default_width, name: fieldName, priority: entity.fields[fieldName].priority, sub_priority: 0 });
            }
            column_list.sort(function(a, b) {
                if(b.priority === a.priority) {
                    return b.sub_priority - a.sub_priority;
                }
                return b.priority - a.priority;
            });
            column_list.forEach(function(col_entry, index) {
                column[col_entry.name] = { index: index, width: default_width };
            });

            var saved = this.getSavedColumns(name);
            for(var saved_field in saved) {
                column[saved_field] = saved[saved_field];
            }

            columns[name] = column;
        }

        return { modal: null, columns: columns };
    }
    ,componentDidMount: function() {
        var this_ref = this;
        $(".global-action-button").click(function() {
            this_ref.showGlobalActionModal($(this).data("name"));
        });
    }
    ,showGlobalActionModal: function(action_name) {

        var action = g_InitialData.global_actions[action_name];

        var this_ref = this;
        this.showModal(action.description, action.input, function(input, callback) {

            if(action.direct_call === true) {

                input._name = action.name;
                input._index = action.index;

                var params = [];
                for(var key in input) {
                    params.push(encodeURIComponent(key) + '=' + encodeURIComponent(input[key]));
                }
                var url = g_InitialData.global_route;
                if(params.length > 0) {
                    url += "?" + params.join('&');
                }
                window.location = url;
                callback(true);

            } else {

                var form_data = new FormData();
                for(var field_name in input) {
                    //if(action.input[field_name].type !== "file") {
                    if(!(input[field_name] instanceof File)) {
                        continue;
                    }
                    form_data.append(field_name, input[field_name]);
                }
                form_data.append("input", JSON.stringify(input));
                form_data.append("name", action.name);
                form_data.append("index", action.index);

                $.ajax({
                    type: "POST"
                    , url: g_InitialData.global_route
                    // ,dataType: "json"
                    , processData: false
                    , contentType: false
                    , data: form_data
                }).done(function (data) {
                    g_InitialData.global_actions = data.global_actions;

                    // todo: make the global actions stuff it's own react component
                    for (var global_name in data.global_actions) {
                        var global = data.global_actions[global_name];
                        $('button[data-name="' + global_name + '"]').html(global.label).removeClass().addClass(global.classes);//.removeClass("hidden");
                    }
                    if(this_ref.props.entity !== undefined) {
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
                    callback(false, (data.responseJSON === undefined) ? "Unknown Error" : data.responseJSON.result);
                });
            }
        });
    }
    ,getSavedColumns: function(entity_name) {
        var saved = localStorage.getItem("_columns_" + entity_name);
        if(saved === null) {
            return {};
        }
        try {
            return JSON.parse(saved);
        } catch(e) {
            return {};
        }
    }
    ,moveHeader: function(entity_name, field_name, diff) {

        var min_width = 60;

        var new_columns = $.extend({}, this.state.columns);
        var new_entity_cols = $.extend({}, new_columns[entity_name]);

        var old = new_entity_cols[field_name];
        var new_width = old.width + diff;

        var saved = this.getSavedColumns(entity_name);

        if((new_width < min_width) && (old.index > 0)) {
            var prev_field_name = Object.keys(new_entity_cols).find(function(name) {
                return (new_entity_cols[name].index === (old.index - 1));
            });
            if(prev_field_name === undefined) {
                return;
            }
            var prev_width = new_entity_cols[prev_field_name].width;
            new_entity_cols[field_name] = { index: (old.index - 1), width: (prev_width + new_width) };
            new_entity_cols[prev_field_name] = { index: old.index, width: prev_width };

            saved[prev_field_name] = new_entity_cols[prev_field_name];
        } else {
            new_entity_cols[field_name] = { index: old.index, width: Math.max(min_width, new_width) };
        }
        saved[field_name] = new_entity_cols[field_name];
        new_columns[entity_name] = new_entity_cols;

        localStorage.setItem("_columns_" + entity_name, JSON.stringify(saved));

        this.setState({ columns: new_columns });
    }
    ,showModal: function(heading, input, callback) { // callback should take an input hash and it's own callback(success, err_msg)
        this.setState({ modal: { heading: heading, input: input, callback: callback } });
    }
    ,hideModal: function() {
        this.setState({ modal: null });
    }
    ,render: function() {

        if(this.props.entity !== undefined) {
            var table = <ItemTable entity={this.props.entity} showModal={this.showModal} columns={this.state.columns} moveHeader={this.moveHeader}/>;
        } else {
            var table = <span>No item selected</span>;
        }

        return  <div className={"wrapper"}>
                    <InputModal input={this.state.modal} hideModal={this.hideModal} columns={this.state.columns} moveHeader={this.moveHeader}/>
                    <div className={"wrapper content"} style={{ top: this.props.offset }}>
                        {table}
                    </div>
                </div>;
    }
});




////////////////////////////////////////////////////////////////////////////////
// INIT
////////////////////////////////////////////////////////////////////////////////
gf_RenderData = function(entity) {

    if(entity !== undefined) {
        $(".global-action-specific").addClass("hidden").filter("." + entity.replace(/\\/g, "-")).removeClass("hidden");
    }
    var el = document.getElementById('main-admin-container');
    var header_height = $(".header").height();
    ReactDOM.render(<AdminContainer entity={entity} offset={header_height}/>, el);
};

if(g_Outstanding !== null) {
    gf_RenderData(g_Outstanding);
    g_Outstanding = null;
} else if(window.location.hash !== "") {
    var name = window.location.hash.replace("#", "");
    gf_RenderData(g_InitialData.entity_names[name]);
} else {
    gf_RenderData();
}