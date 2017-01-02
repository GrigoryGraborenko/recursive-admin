
#Recursive Admin for Symfony & Doctrine

This bundle automatically provides an admin dashboard to manage all your doctrine entities. It presents each entity as a table of instances, and every association can be expanded recursively into a new table. It has an ajax-driven React front end, and customizable entry points for both global and per-entity actions. 

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
```

Add a route for the dashboard in your routing.yml:

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

## Usage
Click around and figure it out. I'll finish this documentation later.
TODO: finish this

## Development

### Annotations
Each entity can have two types of annotations: Per-entity, and per-field. Both use the @Admin annotation, and have similar options.
#### Entity Annotation
TODO: finish this
#### Field Annotation
TODO: finish this
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
	  method: FUNCTION_NAME
```

These functions will each be called each time you view a new entity, load the page or activate a global function. The functions themselves will receive two arguements, the service container and the admin user who is currently logged in. The user arguement is in case you want to create or omit custom actions based on user's data. It is not required for permissions management, which is described below. Here is a sample service global actions function:

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
			,"input" => user_input
		)
	);
}
```

This function should return a key-value array of global actions. Each action is a key-value array of specifications, and will be a button in the top part of the admin dashboard. The button can be styled using bootstrap classes using the optional "classes" key, with the text determined by the "label" key. Note that since this function is called after *any* global action is executed, you can generate dynamic, meaningful labels and styles for your buttons that are context sensitive. The "visible" key is optional and is an array of fully qualified entity names on which the global action should be visible under. The "description" key is for the text at the top of the modal that pops up when you click the button. The "input" key is fairly complex and will be described in the "Action Input Specification" section below.

TODO: finish callback function spec

#### Action Input Specification
TODO: finish this

#### Entity Actions
TODO: finish this
## License

Total Democracy is open source.

[Read the license here](./LICENSE)