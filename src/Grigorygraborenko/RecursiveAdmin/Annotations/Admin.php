<?php
/**
 * Created by PhpStorm.
 * User: Grigory
 * Date: 11-May-16
 * Time: 1:53 PM
 */

namespace Grigorygraborenko\RecursiveAdmin\Annotations;

use Doctrine\Common\Annotations\Annotation;

/**
 * @Annotation
 */
final class Admin extends Annotation {
    public $entity = NULL;      // can see the entity
    public $read = NULL;        // can see a field, or all fields by default
    public $write = NULL;       // can edit a field, or all fields by default
    public $sortBy = NULL;      // which field in this entity to sort a list of parents by
    public $create = NULL;      // can create an entity, or child entity of association
    public $destroy = NULL;     // can destroy an entity, or child entity of association
    public $priority = NULL;    // what order an entity or field appears in
    public $label = NULL;       // what text appears next to an entity or field
}