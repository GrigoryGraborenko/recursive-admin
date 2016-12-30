
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
TODO: finish this
#### Entity Actions
TODO: finish this
## License

Total Democracy is open source.

[Read the license here](./LICENSE)