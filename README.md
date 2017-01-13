
#Recursive Admin for Symfony & Doctrine

This bundle automatically provides an admin dashboard to manage all your doctrine entities. It presents each entity as a table of instances, and every association can be expanded recursively into a new table. Fine-grained permissions for entities, fields and actions are specifiable through annotations. It has an ajax-driven React front end, and customizable entry points for both global and per-entity actions. 

Please note this bundle is still under development, so it probably won't look pretty until halfway through 2017. It's currently in use by two projects the author is developing for: a commercial and a non-profit project. Sonata admin was found to be insufficient for both those needs. 

## Installation

This library can be installed via composer:

```bash
composer require grigorygraborenko/recursive-admin
```	

or add this to your composer.json file directly:

```json
"grigorygraborenko/recursive-admin": "master"
```

Include the bundle in AppKernel.php:

```php
$bundles = [
...
new Grigorygraborenko\RecursiveAdmin\RecursiveAdminBundle(),
```

Then somewhere in your config.yml, add the minimum default permissions for entity management:

```yml
recursive_admin:
    default_permissions:
        entity: [ROLE_ADMIN]
        read: [ROLE_ADMIN]
        write: [ROLE_SUPER_ADMIN]
        create: [ROLE_SUPER_ADMIN]
        destroy: [ROLE_SUPER_ADMIN]
	back_route: YOUR_HOME_PAGE_ROUTE	
```

The attribute "back_route" is optional and will simply add a back button to the dashboard linking to that route name. Add a route for the dashboard in your routing.yml:

```yml
recursive_admin:
    resource: "@RecursiveAdminBundle/Controller/"
    type:     annotation
    prefix:   /YOUR-URL-HERE
```

Then finally, make sure to firewall off this route in security.yml:

```yml
    access_control:
		...
        - { path: ^/YOUR-URL-HERE/, role: ROLE_ADMIN }
```

If you don't do this last step, your non-admin users might be able to access a blank page with no entities.

There is also an optional "testing" attribute:

```yml
recursive_admin:
    testing:
        allow_fake_data_creation: "%recursive_admin.testing.fake_data%"
        permission: ROLE_SUPER_ADMIN
```

It is highly recommended you don't enable this, or restrict it severely. If "allow_fake_data_creation" is set to true, it will show a button for each entity that allows users to create an arbitrary number of fake entity instances with randomized data and associations. This is useful for testing purposes, especially scale testing.

## Usage
Click around and figure it out. I'll finish this documentation later.
TODO: finish this

## Development

### Annotations
Each entity can have two types of annotations: Per-entity, and per-field. Both use the @Admin annotation, and have similar options.

An entity annotation with field annotations might look like this:
```php

use Grigorygraborenko\RecursiveAdmin\Annotations\Admin;

/**
 * @ORM\Entity
 * @Admin(entity=["ROLE_ADMIN", "ROLE_TESTER"], sortBy="name", priority=1000, label="Result of Test")
 */
class TestResult {

	/**
	 * @ORM\Column(type="string")
	 * @Admin(read="ROLE_ADMIN", priority=10, label="Test Name")
	 */
	protected $name;
```

Below are the various options for the annotation and their effects. All of them are optional, and you don't even need the admin annotation on the entity or it's fields for it to show up in the admin dashboard. Most of these are permission strings/arrays. If you want no user to be permitted to see or edit a field, set that permission to "none" or some other string that doesn't exist as a user role. This can be useful for blanket banning a permission at the entity level and then selectively allowing certain fields, or vice versa. If neither entity-level or field-level permissions are set, the default permissions specified in your config file are used.

#### "entity" option
This option is only valid for entities and is ignored for fields. It requires either a string or array of strings of user roles. This determines what level of user can even see that the entity exists.

#### "read" option
Requires either a string or array of strings of user roles. On a field, it determines if that field and it's data is visible to that user. On an entity, it determines the default read permission level for all of that entity's fields. The per-field annotation will take precedence over the per-entity annotation.

#### "write" option
Requires either a string or array of strings of user roles. On a field, it determines if that field and it's data is editable by that user. On an entity, it determines the default write permission level for all of that entity's fields. The per-field annotation will take precedence over the per-entity annotation.

#### "label" option
Requires a string. For fields, this is the text at the top of the column in the data table. For entities, it's the text of the button you click on to view the entity data. 

#### "priority" option
Requires an integer. For fields, this determines the order of the columns shown. For entities, it determines the order of the entities listed at the top. The highest numbers are displayed first. Negative priorities for entities will result in them being initially hidden behind a "show more" button.

#### "create" option
Requires either a string or array of strings of user roles. On a field, it determines if that user can create this entity. On a field, it is only valid for associations of one-to-many types, and determines if this user can create this child entity with the parent association already filled in.

For example, if a user can have multiple orders, the user table will show a column for a list of orders. If this field is annotated with this option, then there will be an add button, which will bring up a modal where you can create a new order with the user already chosen based on who you clicked on. 

#### "destroy" option
This option is only valid for entities and is ignored for fields. Requires either a string or array of strings of user roles. It determines if the user can destroy this entity.

#### "sortBy" option
This option is only valid for entities and is ignored for fields. It requires a string, and needs to be the name of a field. If another entity refers to this one, and you sort the other entity by that association, this field will be used to determine the sorting order. One mandatory side effect is that this also determines how the other entity renders the association.

For example, if a user can have multiple orders, the order table will show a column for the user who owns that order. Sorting that column will order by the user's "sortBy" field. If it's that user's email, then the order table will show an expandable email for the user column, and sorting that will impose an alphabetical email sort on the order table.

### Actions
There are two types of custom actions a developer can specify: global and per-entity. Global actions will appear in the top bar, and can be hidden/shown depending on the entity. Per-entity actions will appear in the table once per row. 
#### Global Actions
In the config.yml file under recursive_admin, add a list of services with public function names:

```yml
global_actions:
	-
	  service: SERVICE_NAME
	  method: SERVICE_FUNCTION
	-
	  service: OTHER_SERVICE_NAME
	  method: OTHER_SERVICE_FUNCTION
```

These functions will each be called each time you view a new entity, load the page or activate a global function. The functions themselves will receive two arguments, the service container and the admin user who is currently logged in. The user argument is in case you want to create or omit custom actions based on user's data. It is not required for permissions management, which is described below. Here is a sample service global actions function:

```php
public function SERVICE_FUNCTION($container, $admin) {

	$user_input = array(
		"api" => array(
			"type" => "select"
			,"label" => "Which API?"
			,"choices" => array(
				array("label" => "Internal", "value" => "int_01")
				,array("label" => "External", "value" => "ext_02")
				,array("label" => "All of them", "value" => "*")
			)
		)
		,"num_tests" => array(
			"type" => "integer"
			,"label" => "How many times should the tests run?"
			,"default" => 1
			,"required" => true
		)
	);

	return array(
		"tests" => array(
			"callback" => "runTests"
			,"label" => "Test APIs"
			,"description" => "Run automatic tests for each API"
			,"permission" => "ROLE_ADMIN"
            ,"classes" => "btn btn-xs btn-warning"
            ,"visible" => array('AppBundle\Entity\ApiEntry', 'AppBundle\Entity\TestResult')
			,"input" => $user_input
		)
	);
}
```

This function should return a key-value array of global actions. Each action is a key-value array of specifications, and will be a button in the top part of the admin dashboard. The button can be styled using bootstrap classes using the optional "classes" key, with the text determined by the "label" key. 

Note that since this function is called after *any* global action is executed, you can generate dynamic, meaningful labels and styles for your buttons that are context sensitive. 

The "visible" key is optional and is an array of fully qualified entity names on which the global action should be visible under. The "description" key is for the text at the top of the modal that pops up when you click the button. The "input" key is fairly complex and will be described in the "Action Input Specification" section below.

The callback function takes three arguments: the service container, the currently logged in admin, and an input key-value array. It should return either a string when an error occurs, or a key-value array for success. Returning a "report" key will display a success modal with the report string, formatted to handle newlines. Returning with a key "refresh" set to true will instead reload the modal with the fields cleared.

```php
public function runTests($container, $admin, $input) {
	...
	if($some_error) {
		return "Tests had an error of some sort";
	}
	...
	return array("report" => "Everything went well");
}
```

You can also return a key-value array under the key "file" with this structure:

```php
return array("file" => array("name" => "test_results.csv", "contents" => "test,result\ninternal,passed\nexternal,passed\n"));
```

#### Action Input Specification

Global and per-entity actions will trigger modals with customizable inputs. Here is an example of what a particularly complex input specification might look like, with examples of all types of inputs:

```php
	$user_input = array(
		"test_name" => array("type" => "string", "label" => "Name of New Test", "required" => true)
		,"test_quantity" => array("type" => "integer", "label" => "How many times it should run", "default" => 1)
		,"test_fraction" => array("type" => "decimal", "label" => "Fraction of acceptable errors", "required" => true, "default" => 0.1)
		,"test_critical" => array("type" => "boolean", "label" => "Is this test critical?", "default" => false)
		,"test_type" => array("type" => "select", "label" => "Type of test", "default" => "internal", "choices" => array(
			array("label" => "Internal", "value" => "internal")
			,array("label" => "External", "value" => "external")
			,array("label" => "Both internal & external", "value" => "hybrid")
		))
		,"test_rerun" => array("type" => "select", "label" => "Re-run in case of failure?", "default" => "false", "choices" => array(
			array("label" => "No", "value" => "false")
			,array("label" => "Yes", "value" => "true", "input" => array(
				"test_num_reruns" => array("type" => "integer", "label" => "How many times it should attempt to re-run", "default" => 10)
				,"test_justification" => array("type" => "string", "label" => "Why should this test re-run?", "default" => "Because why not.")
			))
		))
		,"test_user" => array("type" => "entity", "label" => "A user responsible for this test", "entity" => 'AppBundle\Entity\User')
		,"test_dependencies" => array("type" => "multientity", "label" => "A list of tests that must run first", , "entity" => 'AppBundle\Entity\TestSpec')
		,"test_error_descriptions" => array("type" => "array", "label" => "A list of descriptions for error codes", "input" => array(
			"code" => array("type" => "integer", "label" => "Error code", "required" => true)
			,"description" => array("type" => "string", "label" => "Description", "required" => true)
		))
		,"test_file" => array("type" => "file", "label" => "Upload a file", "required" => true)
	);
```

When the user clicks OK on the modal, an array is sent to the callback function with the user's values for each input as a key. In this example, it will have keys such as "test_name" (a string), "test_fraction" (a boolean) and "test_file" (a Symfony\Component\HttpFoundation\File\UploadedFile object). Here is an example of what you might get from this above structure:

```php
	// the callback function will get something like this back:
	$input_result = array(
		"test_name" => "Division by zero"
		,"test_quantity" => 3
		,"test_fraction" => 0.2
		,"test_type" => "internal"
		,"test_rerun" => "true" // if this was "false", the array would not have the next two entries
		,"test_num_reruns" => 126 // only appears if "test_rerun" was "true"
		,"test_justification" => "Just in case that zero wasn't really zero, but a really small number." // only appears if "test_rerun" was "true"
		,"test_user" => "ID_43tgf43mn9j38er23" // Not an object, but an ID
		,"test_dependencies" => array("ID_3hj767jfgfdg", "ID_rthg54trhytj4t") // Not an array of objects, but ID's
		,"test_error_descriptions" => array(
			array("code" => 12, "description" => "Something mysterious went wrong")
			,array("code" => 46, "description" => "Negative zero encountered")
			,array("code" => 1, "description" => "There was an error detected in the error detection subroutines")
		)
		,"test_file" => [OBJECT]
	);
```

Inputs arrays are consistant across the various methods of triggering them, and they are recursive too. The input result for "test_error_descriptions" will be an array, with each item in that array the exact same format as you would get from a non-recursive input spec. This can be nested as deep as you like.

However, the same is not true of the input specs that live under a select input type's options. You can declare a select type which creates a drop-down box with values. When that value is selected, by default or by the user, the optional "input" attribute can dynamically create further inputs. This can be nested as deep as you like. The resulting values, unlike array input types, will actually be declared at the same level of the array as the top-level inputs. For example, in the above sample result, "test_num_reruns" was at the same array level of nesting as "test_rerun". The main reason this strange array flattening takes place is because there is no simple, clean method of returning the value *as well as* the potential input array. Gaze upon this horror and agree:

```php
	// either this...
	,"test_rerun" => array("value" => "true", "input" => array(
		"test_num_reruns" => 126
		,"test_justification" => "Just in case that zero wasn't really zero, but a really small number."
	)
	// ...or this
	,"test_rerun" => array("value" => "false", "input" => array()
```

#### Entity Actions
TODO: finish this
## License

Recursive admin is open source under the GNU GPLv3 license.

[Read the license here](./LICENSE)