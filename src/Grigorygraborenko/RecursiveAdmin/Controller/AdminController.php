<?php
/**
 * Created by PhpStorm.
 * User: Grigory
 * Date: 03-May-16
 * Time: 1:30 PM
 */

namespace Grigorygraborenko\RecursiveAdmin\Controller;

use Doctrine\ORM\EntityManager;
use Doctrine\ORM\Tools\Pagination\Paginator;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;

use Doctrine\Common\Annotations\AnnotationReader;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;

use Carbon\Carbon;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Method;

use JMS\DiExtraBundle\Annotation as DI;
use Grigorygraborenko\RecursiveAdmin\Annotations\Admin;

/**
 * Class AdminController
 * @package RecursiveAdminBundle\Controller
 */
class AdminController extends Controller {

    /**
     * @DI\Inject("logger")
     * @var LoggerInterface $logger
     */
    private $logger;

    /**
     * @DI\Inject("doctrine.orm.entity_manager")
     * @var EntityManager $em
     */
    private $em;

    /**
     * @DI\Inject("security.authorization_checker")
     */
    private $role_checker;

    /**
     * @DI\Inject("%recursive_admin.config%")
     */
    private $config;

    private $association_translations;

    /**
     * AdminController constructor.
     * See Doctrine\ORM\Mapping\ClassMetadataInfo for details
     */
    public function __construct() {
        $this->association_translations = array(
            1 => "one_one"
            ,2 => "many_one"
            ,4 => "one_many"
            ,8 => "many_many"
        );
    }

    /**
     * Checks field against field, class then default permission set
     *
     * @param $type
     * @param $class_admin
     * @param null $property_admin
     * @param bool $ignore_defaults
     * @return bool
     */
    private function hasPermission($type, $class_admin, $property_admin = NULL, $ignore_defaults = false) {

        if(($type !== "read") && ($type !== "write") && ($type !== "entity") && ($type !== "create") && ($type !== "destroy")) {
            return false;
        }
        if($property_admin && ($property_admin->{$type})) {
            $role = $property_admin->{$type};
        } else if($class_admin && ($class_admin->{$type})) {
            $role = $class_admin->{$type};
        } else if($ignore_defaults) {
            return false;
        } else {
            $role = $this->config["default_permissions"][$type];
        }
        if(!is_array($role)) {
            return $this->role_checker->isGranted($role);
        }
        foreach($role as $role_str) {
            if($this->role_checker->isGranted($role_str)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Show admin test page
     *
     * @Route("/", name="sr-admin-home")
     */
    public function adminAction() {

        $user = $this->getUser();
        $metadata = $this->em->getMetadataFactory()->getAllMetadata();

        $entities = array();
        $entity_names = array();

        $reader = new AnnotationReader();

        $output_entities = array();
        foreach($metadata as $meta) {

            if(count($meta->getIdentifierFieldNames()) === 0) {
                continue;
            }

            $reflection = $meta->getReflectionClass();
            $class_permission = $reader->getClassAnnotation($reflection, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");

            if(!$this->hasPermission("entity", $class_permission)) {
                continue;
            }

            $assocs = $meta->getAssociationMappings(); // http://www.doctrine-project.org/api/orm/2.5/class-Doctrine.ORM.Mapping.ClassMetadata.html

            $associations = array();
            foreach($this->association_translations as $translation) {
                $associations[$translation] = array();
            }
            $any_mandatory_many_to_one = false;
            foreach($assocs as $assoc) {
                $prop = $reflection->getProperty($assoc['fieldName']);
                $prop_admin = $reader->getPropertyAnnotation($prop, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");
                if((!$this->hasPermission("read", $class_permission, $prop_admin)) && (!$meta->isIdentifier($assoc['fieldName']))) {
                    continue;
                }

                $target_metadata = $this->em->getMetadataFactory()->getMetadataFor($assoc['targetEntity']);
                $target_reflection = $target_metadata->getReflectionClass();
                $target_permission = $reader->getClassAnnotation($target_reflection, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");
                $assoc['expand_permission'] = $this->hasPermission("entity", $target_permission);

                $type = $this->association_translations[$assoc['type']];
                $assoc['type_name'] = $type;

                if($this->hasPermission("create", NULL, $prop_admin, true) && $this->hasPermission("create", $target_permission)) {
                    $assoc['create_permission'] = true;
                }
                if($prop_admin && ($prop_admin->label !== NULL)) {
                    $assoc['label'] = $prop_admin->label;
                } else {
                    $assoc['label'] = $this->makeNameReadable($assoc['fieldName']);
                }
                if($prop_admin && ($prop_admin->priority !== NULL)) {
                    $assoc['priority'] = $prop_admin->priority;
                } else {
                    $assoc['priority'] = 0;
                }

                $associations[$type][] = $assoc;
                if(($type === "many_one") && ((!array_key_exists("joinColumns", $assoc)) || (!array_key_exists("nullable", $assoc["joinColumns"][0])) || ($assoc["joinColumns"][0]["nullable"] === false))) {
                    $any_mandatory_many_to_one = true;
                }
            }
            $name = explode('\\', $meta->getName());
            $name = $name[count($name) - 1];

            if(array_key_exists($name, $entity_names)) {
//            if(true) {
                $name = str_replace("\\", ".", $meta->getName());
            }
            $entity_names[$name] = $meta->getName();


            $entity_fields = array();
            foreach($meta->getFieldNames() as $field_name) {

                $prop = $reflection->getProperty($field_name);
                $prop_admin = $reader->getPropertyAnnotation($prop, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");
                if((!$this->hasPermission("read", $class_permission, $prop_admin)) && (!$meta->isIdentifier($field_name))) {
                    continue;
                }

                $entity_field = $meta->getFieldMapping($field_name);
                $entity_field["editable"] = $this->hasPermission("write", $class_permission, $prop_admin);

                $choice = $reader->getPropertyAnnotation($prop, "Symfony\\Component\\Validator\\Constraints\\Choice");
                if($choice && ($choice->choices)) {
                    $entity_field['choices'] = $choice->choices;
                }
                if($prop_admin && ($prop_admin->label !== NULL)) {
                    $entity_field['label'] = $prop_admin->label;
                } else {
                    $entity_field['label'] = $this->makeNameReadable($field_name);
                }
                if($prop_admin && ($prop_admin->priority !== NULL)) {
                    $entity_field['priority'] = $prop_admin->priority;
                } else {
                    $entity_field['priority'] = 0;
                }

                $entity_fields[$field_name] = $entity_field;
            }

            $creation = NULL;
            $actions = array();
            if($reflection->hasMethod("adminStatic")) {
                $entity_info = call_user_func(array($meta->getName(), 'adminStatic'), $this->container, $user);
                if(array_key_exists("headers", $entity_info)) {
                    foreach($entity_info['headers'] as $header) {

                        if(array_key_exists("permission", $header)) {
                            if(!$this->role_checker->isGranted($header["permission"])) {
                                continue;
                            }
                        }
                        if(array_key_exists("priority", $header)) {
                            $priority = $header['priority'];
                        } else {
                            $priority = 50;
                        }

                        $actions[] = array("label" => $header['label'], "priority" => $priority);
                    }
                }
                if(array_key_exists("create", $entity_info) && array_key_exists("input", $entity_info["create"])) {
                    $creation = $entity_info["create"]['input'];
                }
            }

            if($class_permission && ($class_permission->label !== NULL)) {
                $label = $class_permission->label;
            } else {
                $label = $this->makeNameReadable($name);
            }
            if($class_permission && ($class_permission->priority !== NULL)) {
                $priority = intval($class_permission->priority);
            } else {
                $priority = 0;
            }

            $entities[$meta->getName()] = array(
                "identifiers" => $meta->getIdentifierFieldNames()
                ,"fields" => $entity_fields
                ,"associations" => $associations
                ,"actions" => $actions
                ,"creation" => $creation
                ,"name" => $name
                ,"label" => $label
                ,"can_create" => $this->hasPermission("create", $class_permission)
                ,"can_destroy" => $this->hasPermission("destroy", $class_permission)
            );

            $entity = array(
                "name" => $name
                ,"label" => $label
                ,"priority" => $priority
                ,"fullName" => $meta->getName()
                ,"meta" => $meta
            );

            if(count($associations['many_one']) > 0) {
                if($any_mandatory_many_to_one) {
                    $entity["hierarchy"] = 0;
                } else {
                    $entity["hierarchy"] = 1;
                }
            } else {
                $entity["hierarchy"] = 2;
            }
            $output_entities[] = $entity;
        }

        $global_actions = $this->getGlobalFunctions($user);

        $json = array(
            "data_route" => $this->get("router")->generate("sr-admin-data")
            ,"graph_route" => $this->get("router")->generate("sr-admin-graph")
            ,"stats_route" => $this->get("router")->generate("sr-admin-stats")
            ,"export_route" => $this->get("router")->generate("sr-admin-export")
            ,"fake_data_route" => $this->get("router")->generate("sr-admin-fake-data")
            ,"edit_route" => $this->get("router")->generate("sr-admin-edit")
            ,"action_route" => $this->get("router")->generate("sr-admin-action")
            ,"create_route" => $this->get("router")->generate("sr-admin-create")
            ,"destroy_route" => $this->get("router")->generate("sr-admin-destroy")
            ,"global_route" => $this->get("router")->generate("sr-admin-global-action")
            ,"entities" => $entities
            ,"entity_names" => $entity_names
            ,"global_actions" => $global_actions
        );

        if(array_key_exists("testing", $this->config) && ($this->config["testing"]["allow_fake_data_creation"] === true) && ($this->role_checker->isGranted($this->config["testing"]["permission"]))) {
            $json["allow_fake_data_creation"] = true;
        }

        usort($output_entities, function($a, $b) {
            if($a['priority'] > $b['priority']) {
                return -1;
            } else if($a['priority'] < $b['priority']) {
                return 1;
            } else if($a['hierarchy'] === $b['hierarchy']) {
                return 0;
            }
            return ($a['hierarchy'] > $b['hierarchy']) ? -1 : 1;
        });

        $output = array(
            "entities" => $output_entities
            ,"global_actions" => $global_actions
            ,"js_output_data" => $json
        );

        if(array_key_exists("back_route", $this->config)) {
            $output["back_route"] = $this->config["back_route"];
        }

        return $this->render('RecursiveAdminBundle:Admin:admin.html.twig', $output);
    }

    /**
     * @param $user
     * @return array
     */
    private function getGlobalFunctions($user) {
        $global_actions = array();
        if(array_key_exists("global_actions", $this->config)) {
            foreach($this->config["global_actions"] as $index => $global) {
                $service = $this->get($global["service"]);
                $action_list = $service->{$global["method"]}($this->container, $user);
                foreach($action_list as $name => $action) {

                    if(!array_key_exists("permission", $action)) {
                        continue;
                    }
                    if(!$this->role_checker->isGranted($action["permission"])) {
                        continue;
                    }

                    $global = array(
                        "index" => $index
                        ,"name" => $name
                    );
                    if(array_key_exists("label", $action)) {
                        $global['label'] = $action['label'];
                    } else {
                        $global['label'] = $name;
                    }
                    if(array_key_exists("description", $action)) {
                        $global['description'] = $action['description'];
                    } else {
                        $global['description'] = $name;
                    }
                    if(array_key_exists("classes", $action)) {
                        $global['classes'] = $action['classes'];
                    } else {
                        $global['classes'] = "btn btn-info btn-xs";
                    }
                    if(array_key_exists("input", $action)) {
                        $global['input'] = $action['input'];
                    }
                    if(array_key_exists("visible", $action)) {
                        $global['classes'] .= " global-action-specific hidden " . str_replace('\\', '-', implode(" ", $action['visible']));
                    }
                    if(array_key_exists("direct_call", $action) && ($action["direct_call"] === true)) {
                        $global['direct_call'] = $action["direct_call"];
                    }
                    $global_actions[$name] = $global;
                }
            }
        }
        return $global_actions;
    }

    /**
     * @param $item
     * @param $metadata
     * @param $reflection
     * @param $reader
     * @param $class_admin
     * @param $associations
     * @return array
     */
    private function getItemOutput($item, $metadata, $reflection, $reader, $class_admin, $associations) {

        $item_output = array();

        if($reflection->hasMethod("adminActions")) {
            $actions_result = $item->adminActions($this->container, $this->getUser());
            $actions = array();
            foreach($actions_result as $name => $spec) {

                if(array_key_exists("permission", $spec)) {
                    if(!$this->role_checker->isGranted($spec["permission"])) {
                        continue;
                    }
                }

                $action = $spec;
                unset($action['callback']);
                $action['name'] = $name;
                $actions[] = $action;
            }
            $item_output["_ACTIONS"] = $actions;
        }

        foreach($metadata->getFieldNames() as $field_name) {

            $prop = $reflection->getProperty($field_name);
            $prop_admin = $reader->getPropertyAnnotation($prop, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");

            if(!($this->hasPermission("read", $class_admin, $prop_admin) || $metadata->isIdentifier($field_name))) {
                continue;
            }

            $val = $metadata->getFieldValue($item, $field_name);
            $item_output[$field_name] = $val;
        }

        foreach($associations as $assoc) {

            $prop = $reflection->getProperty($assoc['fieldName']);
            $prop_admin = $reader->getPropertyAnnotation($prop, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");
            if(!($this->hasPermission("read", $class_admin, $prop_admin) || $metadata->isIdentifier($assoc['fieldName']))) {
                continue;
            }

            $type = $this->association_translations[$assoc['type']];
            $field = $assoc["fieldName"];
            $other_meta = $this->em->getClassMetadata($assoc["targetEntity"]);

            $item_field = NULL;

            $other = NULL;
            if(($type === "many_one") || ($type === "one_one")) {

                $other = $metadata->getFieldValue($item, $field);
                if($other === NULL) {
                    $item_output[$field] = NULL;
                    continue;
                }
                $other_identifiers = $other_meta->getIdentifierFieldNames();

                $id_values = array();
                foreach($other_identifiers as $identifier) {
                    $id_values[$identifier] = $other_meta->getFieldValue($other, $identifier);
                }

                $item_field["identifiers"] = $id_values;
            }
            if(($type === "one_many") || ($type === "many_many")) {
                $others = $metadata->getFieldValue($item, $field);
                $item_field['count'] = count($others);
                if(count($others) === 1) {
                    $other = $others[0];
                }
            }
            if($other) {
                $other_reflection = $other_meta->getReflectionClass();
                if($other_reflection->hasMethod('__toString')) {
                    $item_field["preview"] = $other . "";
                } else if($other_reflection->hasProperty('name')) {
                    $name = $other->getName();
                    if(is_string($name)) {
                        $item_field["preview"] = $name;
                    }
                }
            }
            $item_output[$field] = $item_field;
        }

        return $item_output;
    }

    /**
     * @param $qb
     * @param $input
     * @param $metadata
     * @param $reflection
     * @param $reader
     * @param $class_admin
     */
    private function filterQuery(&$qb, $input, $metadata, $reflection, $reader, $class_admin) {
        $param_num = 1;
        if(array_key_exists("associated-value", $input)) {
            if(array_key_exists("associated-field", $input)) {
                $qb ->innerJoin('e.' . $input["associated-field"], 'assoc');
                foreach($input["associated-value"] as $identifier => $value) {
                    $qb ->andWhere("assoc.$identifier = ?$param_num")
                        ->setParameter($param_num, $value);
                    $param_num++;
                }
            } else if($input["associated-type"] === "many_many") {
                //$qb ->innerJoin('e.' . $input["associated-field"], 'assoc')
            } else {
                foreach($input["associated-value"] as $identifier => $value) {
                    $qb ->andWhere("e.$identifier = ?$param_num")
                        ->setParameter("$param_num", $value);
                    $param_num++;
                }
            }
        }

        if(array_key_exists("filter", $input)) {

            foreach($input['filter'] as $filter) {
                $filterName = $filter['name'];
                $filterType = $filter['type'];
                $filterValue = $filter['value'];

                $prop = $reflection->getProperty($filterName);
                $prop_admin = $reader->getPropertyAnnotation($prop, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");
                if((!$this->hasPermission("read", $class_admin, $prop_admin)) && (!$metadata->isIdentifier($filterName))) {
                    continue;
                }

                if(array_key_exists("only_null", $filter)) {
                    if($filter["only_null"] === "true") {
                        $qb->andWhere("e.$filterName IS NULL");
                        continue;
                    } else {
                        $qb->andWhere("e.$filterName IS NOT NULL");
                    }
                }

                if($filterType === "boolean") {
                    $qb ->andWhere("e.$filterName = ?$param_num")
                        ->setParameter($param_num, $filterValue === "true");
                    $param_num++;
                } else if(($filterType === "integer") || ($filterType === "decimal")) {

                    if(strlen($filterValue["min"]) > 0) {
                        $qb ->andWhere("e.$filterName >= ?$param_num")
                            ->setParameter($param_num, floatval($filterValue["min"]));
                        $param_num++;
                    }
                    if(strlen($filterValue["max"]) > 0) {
                        $qb ->andWhere("e.$filterName <= ?$param_num")
                            ->setParameter($param_num, floatval($filterValue["max"]));
                        $param_num++;
                    }
                } else if(($filterType === "date") || ($filterType === "datetime")) {

                    if(strlen($filterValue["min"]) > 0) {
                        $qb ->andWhere("e.$filterName >= ?$param_num")
                            ->setParameter($param_num, Carbon::parse($filterValue["min"], "UTC"));
                        $param_num++;
                    }
                    if(strlen($filterValue["max"]) > 0) {
                        $qb ->andWhere("e.$filterName <= ?$param_num")
                            ->setParameter($param_num, Carbon::parse($filterValue["max"], "UTC"));
                        $param_num++;
                    }
                } else if($filterType === "choice") {
                    $states = array();
                    foreach($filterValue as $state => $is_on) {
                        if($is_on === "true") {
                            $states[] = $state;
                        }
                    }
                    $qb->andWhere($qb->expr()->in("e.$filterName", $states));
                } else {
                    $qb ->andWhere($qb->expr()->like("e.$filterName", "?$param_num"))
                        ->setParameter($param_num, "%$filterValue%");
                    $param_num++;
                }
            }
        }
    }

    /**
     * @Route("/data", name="sr-admin-data")
     * @Method("POST")
     *
     * @param Request $request
     * @return mixed
     */
    public function adminDataAction(Request $request) {

        $input = $request->request->all();

        if((!array_key_exists("entity", $input)) || (!array_key_exists("page", $input)) || (!array_key_exists("pageSize", $input))) {
            return $this->respondError("Incorrect parameters");
        }

        $metadata = $this->em->getMetadataFactory()->getMetadataFor($input["entity"]);
        $associations = $metadata->getAssociationMappings();
        $reflection = $metadata->getReflectionClass();
        $reader = new AnnotationReader();
        $class_permission = $reader->getClassAnnotation($reflection, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");

        if(!$this->hasPermission("entity", $class_permission)) {
            return $this->respondError("Permission Denied");
        }

        $repo = $this->em->getRepository($input["entity"]);

        $page = intval($input["page"]);
        $page_size = intval($input["pageSize"]);
        if(($page < 0) || ($page_size < 1)) {
            return $this->respondError("Incorrect page number/size");
        }

        $qb = $repo->createQueryBuilder('e');
        $qb->setFirstResult($page * $page_size)->setMaxResults($page_size);

        $this->filterQuery($qb, $input, $metadata, $reflection, $reader, $class_permission);

        if(array_key_exists("sort", $input)) {
            $is_to_many = false;
            foreach($input['sort'] as $sort) {
                $name = $sort['name'];

                $prop = $reflection->getProperty($name);
                $prop_admin = $reader->getPropertyAnnotation($prop, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");
                if((!$this->hasPermission("read", $class_permission, $prop_admin)) && (!$metadata->isIdentifier($name))) {
                    continue;
                }

                $dir = ($sort['ascend'] === "true") ? "ASC" : "DESC";

                if(($sort['type'] === "one_many") || ($sort['type'] === "many_many")) {
                    $tname = "t_" . $name;
                    $fname = "f_" . $name;
                    $qb->addSelect("COUNT($fname) as HIDDEN $tname")
                        ->leftJoin("e.$name", "$fname")
                        ->addOrderBy("$tname", $dir);
                    $is_to_many = true;

                } else if(($sort['type'] === "many_one") || ($sort['type'] === "one_one")) {

                    $field_entity = $metadata->getAssociationTargetClass($name);

                    $sort_metadata = $this->em->getMetadataFactory()->getMetadataFor($field_entity);
                    $sort_reflection = $sort_metadata->getReflectionClass();
                    $sort_permission = $reader->getClassAnnotation($sort_reflection, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");

                    if(($sort_permission !== NULL) && ($sort_permission->sortBy !== NULL)) {
                        $tname = "t_" . $name;
                        $qb->leftJoin("e.$name", "$tname");
                        $qb->addOrderBy("$tname." . $sort_permission->sortBy, $dir);
                    } else if($sort['type'] === "many_one") {
                        $qb->addOrderBy("e.$name", $dir);
                    }
                } else {
                    $qb->addOrderBy("e.$name", $dir);
                }
            }
            if($is_to_many) {
                $qb->groupBy('e');
            }
        }


        $query = $qb->getQuery();
        $paginator = new Paginator($query, true);
        $total = count($paginator);
        $results = $query->getResult();

        $items = array();
        foreach($results as $result) {

            $items[] = $this->getItemOutput($result, $metadata, $reflection, $reader, $class_permission, $associations);
        }

        $output = $input;
        $output['items'] = $items;
        $output['total_items'] = $total;
        if(array_key_exists("entity-name", $input)) {
            $output['entity-name'] = $input['entity-name'];
        }

        $response = new JsonResponse();
        $response->setData($output);
        return $response;
    }

    /**
     * @Route("/graph", name="sr-admin-graph")
     * @Method("POST")
     *
     * @param Request $request
     * @return mixed
     */
    public function adminGraphAction(Request $request) {

        $input = $request->request->all();

        if((!array_key_exists("entity", $input)) || (!array_key_exists("groupBy", $input))) {
            return $this->respondError("Incorrect parameters");
        }

        $metadata = $this->em->getMetadataFactory()->getMetadataFor($input["entity"]);
        $reflection = $metadata->getReflectionClass();
        $reader = new AnnotationReader();
        $class_permission = $reader->getClassAnnotation($reflection, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");

        if(!$this->hasPermission("entity", $class_permission)) {
            return $this->respondError("Permission Denied");
        }

        $group_by = $input['groupBy'];
        $prop = $reflection->getProperty($group_by);
        $prop_admin = $reader->getPropertyAnnotation($prop, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");
        if((!$this->hasPermission("read", $class_permission, $prop_admin)) && (!$metadata->isIdentifier($group_by))) {
            return $this->respondError("Permission Denied");
        }

        $repo = $this->em->getRepository($input["entity"]);
        $qb = $repo->createQueryBuilder('e');

        $field_type = $metadata->getFieldMapping($group_by)['type'];
        if(($field_type === 'date') || ($field_type === 'datetime')) {
            $qb->select("count(distinct(e)) as number_of, DATE(e.$group_by) as value_of")
                ->groupBy("value_of");
        } else {
            $qb ->select("count(distinct(e)) as number_of, e.$group_by as value_of")
                ->groupBy("e.$group_by");
        }

        $this->filterQuery($qb, $input, $metadata, $reflection, $reader, $class_permission);

        $results = $qb->getQuery()->getResult();

        $response = new JsonResponse();
        $response->setData($results);
        return $response;
    }

    /**
     * @Route("/stats", name="sr-admin-stats")
     * @Method("POST")
     *
     * @param Request $request
     * @return mixed
     */
    public function adminStatsAction(Request $request) {

        // this preamble is identical to adminGraphAction - merge into

        $input = $request->request->all();

        if((!array_key_exists("entity", $input)) || (!array_key_exists("groupBy", $input))) {
            return $this->respondError("Incorrect parameters");
        }

        $metadata = $this->em->getMetadataFactory()->getMetadataFor($input["entity"]);
        $reflection = $metadata->getReflectionClass();
        $reader = new AnnotationReader();
        $class_permission = $reader->getClassAnnotation($reflection, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");

        if(!$this->hasPermission("entity", $class_permission)) {
            return $this->respondError("Permission Denied");
        }

        $group_by = $input['groupBy'];
        $prop = $reflection->getProperty($group_by);
        $prop_admin = $reader->getPropertyAnnotation($prop, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");
        if((!$this->hasPermission("read", $class_permission, $prop_admin)) && (!$metadata->isIdentifier($group_by))) {
            return $this->respondError("Permission Denied");
        }

        $repo = $this->em->getRepository($input["entity"]);
        $qb = $repo->createQueryBuilder('e');

        // get min, max, sum, sum of squares
        $qb ->select("sum(e.$group_by) as stats_sum, sum(e.$group_by * e.$group_by) as stats_sum_squares, min(e.$group_by) as stats_min, max(e.$group_by) as stats_max, count(distinct(e)) as stats_count");

        $this->filterQuery($qb, $input, $metadata, $reflection, $reader, $class_permission);

        $results = $qb->getQuery()->getSingleResult();

        $response = new JsonResponse();
        $response->setData($results);
        return $response;
    }

    /**
     * @Route("/export", name="sr-admin-export")
     *
     * @param Request $request
     * @return mixed
     */
    public function adminExportAction(Request $request) {

        $input = $request->query->all();
        if($input['associated-value'] === "") {
            unset($input['associated-value']);
        }
        if($input['associated-field'] === "") {
            unset($input['associated-field']);
        }
        if($input['associated-type'] === "") {
            unset($input['associated-type']);
        }

        if(!array_key_exists("entity", $input)) {
            return $this->respondError("Incorrect parameters");
        }
        $entity = $input["entity"];

        $metadata = $this->em->getMetadataFactory()->getMetadataFor($entity);
        $reflection = $metadata->getReflectionClass();
        $reader = new AnnotationReader();
        $class_permission = $reader->getClassAnnotation($reflection, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");

        if(!$this->hasPermission("entity", $class_permission)) {
            return $this->respondError("Permission Denied");
        }

        $repo = $this->em->getRepository($entity);
        $qb = $repo->createQueryBuilder('e');

        $this->filterQuery($qb, $input, $metadata, $reflection, $reader, $class_permission);

        // todo: sort this as well

        $results = $qb->getQuery()->getResult();

        $field_names = $metadata->getFieldNames();
        $header_labels = array();
        $output_fields = array();
        foreach($field_names as $field_name) {
            $prop = $reflection->getProperty($field_name);
            $prop_admin = $reader->getPropertyAnnotation($prop, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");
            if((!$this->hasPermission("read", $class_permission, $prop_admin)) && (!$metadata->isIdentifier($field_name))) {
                continue;
            }
            $header_labels[] = $field_name;
            $output_fields[] = $field_name;
        }

        $file_content = implode(",", $header_labels) . "\r\n";
        foreach($results as $item) {
            $outputs = array();
            foreach($output_fields as $field) {
                $value = $metadata->getFieldValue($item, $field);
                $type = gettype($value);
                if($type === "object") {
                    $class = get_class($value);
                    if($class === "DateTime") {
                        $value = Carbon::instance($value);
                    } else {
                        $value = "[Object]";
                    }
                } else if($type === "string") {
                    $value = '"' . $value . '"';
                }
                $outputs[] = $value;
            }
            $file_content .= implode(",", $outputs) . "\r\n";
        }

        $timestamp = Carbon::now("UTC")->timestamp;

        // todo: name this something better
        $e_name = explode('\\', $metadata->getName());
        $e_name = $e_name[count($e_name) - 1];

        $file_name = "$e_name-$timestamp.csv";

        $response = new Response($file_content);
        $disposition = $response->headers->makeDisposition(ResponseHeaderBag::DISPOSITION_ATTACHMENT, $file_name);
        $response->headers->set('Content-Disposition', $disposition);
        return $response;
    }

    /**
     * @Route("/fake-data", name="sr-admin-fake-data")
     *
     * @param Request $request
     * @return mixed
     */
    public function adminFakeDataAction(Request $request) {

        $input = $request->request->all();

        if((!array_key_exists("testing", $this->config)) || ($this->config["testing"]["allow_fake_data_creation"] !== true) || (!$this->role_checker->isGranted($this->config["testing"]["permission"]))) {
            return $this->respondError("Access denied");
        }

        if((!array_key_exists("entity", $input)) || (!array_key_exists("amount", $input))) {
            return $this->respondError("Incorrect parameters");
        }
        $num_create = intval($input["amount"]);
        if($num_create < 1) {
            return $this->respondError("Need to create at least one item");
        }

        $metadata = $this->em->getMetadataFactory()->getMetadataFor($input["entity"]);
        $reflection = $metadata->getReflectionClass();

        for($i = 0; $i < $num_create; $i++) {

            $new_item = $reflection->newInstanceWithoutConstructor();
            foreach($metadata->getAssociationMappings() as $assoc) {
                $type = $this->association_translations[$assoc["type"]];
                if(($type === "many_many") || ($type === "one_many")) {
                    continue;
                }
                if(array_key_exists("joinColumns", $assoc) && array_key_exists("nullable", $assoc["joinColumns"][0]) && ($assoc["joinColumns"][0]["nullable"] === true) &&(mt_rand(0, 2) === 0)) {
                    continue;
                }
                $field_name = $assoc['fieldName'];

                $other_repo = $this->em->getRepository($assoc["targetEntity"]);

                $qb = $other_repo->createQueryBuilder('e');
                $qb->setFirstResult(0)->setMaxResults(1);
                $query = $qb->getQuery();
                $paginator = new Paginator($query, true);
                $total = count($paginator);

                $other_item = $other_repo->findBy(array(), array(), 1, mt_rand(0, $total - 1))[0];

                $metadata->setFieldValue($new_item, $field_name, $other_item);
            }

            foreach($metadata->getFieldNames() as $field_name) {

                $entity_field = $metadata->getFieldMapping($field_name);
                if(($entity_field["nullable"] === true) &&(mt_rand(0, 2) === 0)) {
                    continue;
                }

                $type = $entity_field["type"];
                if($type ===  "date") {
                    $value = Carbon::now("UTC")->subYears(mt_rand(0, 5))->subDays(mt_rand(0, 365));
                } else if($type ===  "datetime") {
                    $value = Carbon::now("UTC")->subDays(mt_rand(0, 365))->subSeconds(mt_rand(0, 86400));
                } else if($type ===  "integer") {
                    $value = mt_rand(0, 10000);
                } else if($type ===  "decimal") {
                    $value = mt_rand(0, 1000000) * 0.01;
                } else if($type ===  "boolean") {
                    $value = mt_rand(0, 1) === 0;
                } else {
                    $value = md5(rand());
                }
                $metadata->setFieldValue($new_item, $field_name, $value);
            }
            $this->em->persist($new_item);
        }
        $this->em->flush();

        $response = new JsonResponse();
        $response->setData(array());
        return $response;
    }

    /**
     * @Route("/edit", name="sr-admin-edit")
     * @Method("POST")
     *
     * @param Request $request
     * @return mixed
     */
    public function adminEditAction(Request $request) {

        $input = $request->request->all();

        if((!array_key_exists("entity", $input)) || (!array_key_exists("identifiers", $input)) || (!array_key_exists("field", $input)) || (!array_key_exists("value", $input))) {
            return $this->respondError("Incorrect parameters");
        }

        $metadata = $this->em->getMetadataFactory()->getMetadataFor($input["entity"]);
        $reflection = $metadata->getReflectionClass();
        if(!$reflection->hasProperty($input['field'])) {
            return $this->respondError("Field does not exist");
        }
        if($metadata->isIdentifier($input['field'])) {
            return $this->respondError("Cannot edit identifier");
        }

        $prop = $reflection->getProperty($input['field']);
        $reader = new AnnotationReader();
        $prop_admin = $reader->getPropertyAnnotation($prop, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");
        $class_admin = $reader->getClassAnnotation($reflection, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");
        if((!$this->hasPermission("write", $class_admin, $prop_admin)) || (!$this->hasPermission("entity", $class_admin))) {
            return $this->respondError("Permission Denied");
        }

        $repo = $this->em->getRepository($input["entity"]);

        $item = $repo->findOneBy($input["identifiers"]);
        if($item === NULL) {
            return $this->respondError("Could not find item");
        }

        $value = $input['value'];
        $field = $metadata->getFieldMapping($input['field']);
        if(($value !== NULL) && (($field['type'] === "datetime") || ($field['type'] === "date"))) {
            $value = Carbon::createFromTimestampUTC($value);
        }

        $metadata->setFieldValue($item, $input['field'], $value);

        $validator = $this->get('validator');
        $errors = $validator->validate($item);

        if(count($errors) > 0) {
            return $this->respondError("Validation Error: " . $errors);
        }

        $this->em->flush();

        $output = array(
            "item" => $this->getItemOutput($item, $metadata, $reflection, $reader, $class_admin, $metadata->getAssociationMappings())
        );

        $response = new JsonResponse();
        $response->setData($output);
        return $response;
    }

    /**
     * @Route("/create", name="sr-admin-create")
     * @Method("POST")
     *
     * @param Request $request
     * @return mixed
     */
    public function adminCreateAction(Request $request) {
        $input = $request->request->all();

        if((!array_key_exists("entity", $input)) || (!array_key_exists("input", $input))) {
            return $this->respondError("Incorrect parameters");
        }

        $metadata = $this->em->getMetadataFactory()->getMetadataFor($input["entity"]);
        $reflection = $metadata->getReflectionClass();
        $reader = new AnnotationReader();
        $class_admin = $reader->getClassAnnotation($reflection, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");

        if(!$this->hasPermission("create", $class_admin)) {
            return $this->respondError("Permission denied");
        }

        $user = $this->getUser();
        $creation_spec = NULL;
        if($reflection->hasMethod("adminStatic")) {
            $entity_info = call_user_func(array($metadata->getName(), 'adminStatic'), $this->container, $user);
            if(array_key_exists("create", $entity_info) && array_key_exists("callback", $entity_info["create"])) {
                $creation_spec = $entity_info["create"];
            }
        }

        $input = $input['input'];

        if($creation_spec === NULL) {
            $new_item = $reflection->newInstanceWithoutConstructor();

            foreach($metadata->getAssociationMappings() as $assoc) {
                $field_name = $assoc['fieldName'];
                if(!array_key_exists($field_name, $input)) {
                    continue;
                }

                $other_repo = $this->em->getRepository($assoc["targetEntity"]);
                $other_item = $other_repo->findOneBy($input[$field_name]);

                $metadata->setFieldValue($new_item, $field_name, $other_item);
            }
            foreach($metadata->getFieldNames() as $field_name) {
                if(!array_key_exists($field_name, $input)) {
                    continue;
                }
                $value = $input[$field_name];
                if(($value === "") || ($value === NULL)) {
                    continue;
                }
                $field = $metadata->getFieldMapping($field_name);
                if(($field['type'] === "datetime") || ($field['type'] === "date")) {
                    $value = Carbon::createFromTimestampUTC($value);
                }

                $metadata->setFieldValue($new_item, $field_name, $value);
            }
        } else {
            $input = $this->processInput($creation_spec['input'], $input);
            $new_item = call_user_func(array($metadata->getName(), $creation_spec['callback']), $this->container, $user, $input);
        }

        if($new_item === NULL) {
            return $this->respondError("Unknown Error");
        }
        if(is_string($new_item)) {
            return $this->respondError($new_item);
        }

        $this->em->persist($new_item);
        $this->em->flush();

        $response = new JsonResponse();
        $response->setData(array("success" => true, "item" => $new_item));
        return $response;
    }

    /**
     * @Route("/destroy", name="sr-admin-destroy")
     * @Method("POST")
     *
     * @param Request $request
     * @return mixed
     */
    public function adminDestroyAction(Request $request) {
        $input = $request->request->all();

        if(!array_key_exists("entity", $input)) {
            return $this->respondError("Incorrect parameters");
        }

        $proc_input = $this->processInput(array("entities" => array("type" => "multientity", "entity" => $input["entity"])), array("entities" => $input["ids"]));
        $doomed_entities = $proc_input["entities"];

        foreach($doomed_entities as $entity) {
            $this->em->remove($entity);
        }

        $this->em->flush();

        $response = new JsonResponse();
        $response->setData(array("success" => true, "count" => count($doomed_entities)));
        return $response;
    }
    
    /**
     * @Route("/action", name="sr-admin-action")
     * @Method("POST")
     *
     * @param Request $request
     * @return mixed
     */
    public function adminActionAction(Request $request) {

        $input = $request->request->all();

        if( (!array_key_exists("entity", $input)) ||
            (!array_key_exists("identifiers", $input)) ||
            (!array_key_exists("name", $input))) {
            return $this->respondError("Incorrect parameters");
        }

        $metadata = $this->em->getMetadataFactory()->getMetadataFor($input["entity"]);
        $reflection = $metadata->getReflectionClass();
        $reader = new AnnotationReader();
        $class_admin = $reader->getClassAnnotation($reflection, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");

        if(!$this->hasPermission("entity", $class_admin)) {
            return $this->respondError("Access Denied");
        }

        $repo = $this->em->getRepository($input["entity"]);
        $item = $repo->findOneBy($input["identifiers"]);
        if($item === NULL) {
            return $this->respondError("Could not find item");
        }

        if(!$reflection->hasMethod("adminActions")) {
            return $this->respondError("Item does not have adminActions");
        }
        $actions_result = $item->adminActions($this->container, $this->getUser());
        if(!array_key_exists($input["name"], $actions_result)) {
            return $this->respondError("Action not found");
        }
        $action = $actions_result[$input["name"]];

        if(array_key_exists("permission", $action)) {
            if(!$this->role_checker->isGranted($action["permission"])) {
                return $this->respondError("Access Denied");
            }
        }

        if(!array_key_exists("callback", $action)) {
            return $this->respondError("Callback is not specified");
        }
        if(!$reflection->hasMethod($action["callback"])) {
            return $this->respondError("Callback function does not exist");
        }

        $input_vars = NULL;
        if(array_key_exists("input", $input)) {
            $input_vars = $this->processInput($action["input"], $input['input']);
        }

        try {
            $result = $item->{$action["callback"]}($this->container, $this->getUser(), $input_vars, $input["name"]);
        } catch(\Exception $e) {
            return $this->respondError("Error: " . $e->getMessage() . ", " . $e->getTraceAsString());
        }
        if($result === NULL) {
            return $this->respondError("Error: Action returned NULL");
        } else if(is_string($result)) {
            return $this->respondError("Error: " . $result);
        }

        $item_output = $this->getItemOutput($item, $metadata, $reflection, $reader, $class_admin, $metadata->getAssociationMappings());

        $output = array_merge($result, array("item" => $item_output));

        $response = new JsonResponse();
        $response->setData($output);
        return $response;
    }

    /**
     * @param $name
     * @param $index
     * @param $input
     * @param $expect_direct
     * @return array
     */
    private function globalAction($name, $index, $input, $expect_direct) {

        if(!array_key_exists("global_actions", $this->config)) {
            return array(false, "No global actions defined");
        }

        if(($index < 0) || ($index >= count($this->config['global_actions']))) {
            return array(false, "Global action index out of range");
        }

        $user = $this->getUser();
        $global = $this->config['global_actions'][$index];
        $service = $this->get($global['service']);
        $action_list = $service->{$global["method"]}($this->container, $user);

        if(!array_key_exists($name, $action_list)) {
            return array(false, "Action does not exist");
        }
        $action = $action_list[$name];
        if(!$this->role_checker->isGranted($action["permission"])) {
            return array(false, "Permission denied");
        }
        if(!array_key_exists("callback", $action)) {
            return array(false, "Action callback does not exist");
        }
        if($expect_direct && ($action["direct_call"] !== true)) {
            return array(false, "Cannot make direct call to this action");
        }

        $input = $this->processInput($action["input"], $input);

        // makes the call to the service with the input and gets the result
        try {
            $result = $service->{$action["callback"]}($this->container, $user, $input);
        } catch(\Exception $e) {
            return array(false, "Exception thrown: $e");
        }

        if(is_string($result)) {
            return array(false, $result);
        }
        if($result === NULL) {
            return array(false, "Need to return an array, string or response from a global action");
        }

        return array(true, $result);
    }

    /**
     * @Route("/global", name="sr-admin-global-action")
     *
     * @param Request $request
     * @return JsonResponse
     * @throws \Exception
     */
    public function adminGlobalActionAction(Request $request) {

        if($request->getMethod() === "POST") {

            $post_input = $request->request->all();
            $file_list = $request->files->all();
            if ((!array_key_exists("name", $post_input)) ||
                (!array_key_exists("index", $post_input))
            ) {
                return $this->respondError("Incorrect parameters");
            }

            $input = NULL;
            if(array_key_exists("input", $post_input)) {
                $input = json_decode($post_input["input"], true);
                foreach($file_list as $fieldname => $file) {
                    $input[$fieldname] = $file;
                }
            }

            list($success, $result) = $this->globalAction($post_input['name'], intval($post_input['index']), $input, false);
            if(!$success) {
                return $this->respondError($result);
            }
        } else {

            $input = $request->query->all();
            if ((!array_key_exists("_name", $input)) ||
                (!array_key_exists("_index", $input))
            ) {
                return new RedirectResponse($this->get('router')->generate('sr-admin-home'));
            }

            list($success, $result) = $this->globalAction($input["_name"], intval($input['_index']), $input, true);
            if(!$success) {
                return new RedirectResponse($this->get('router')->generate('sr-admin-home'));
            }
            return $result;
        }

        $output = array(
            "success" => true
            ,"result" => $result
            ,"global_actions" => $this->getGlobalFunctions($this->getUser())
        );

        $response = new JsonResponse();
        $response->setData($output);
        return $response;

    }

    /**
     * @param $name
     * @return mixed
     */
    private function makeNameReadable($name) {
        return ucwords(strtolower(str_replace("_", " ", trim(preg_replace('/(?!^)[A-Z]{2,}(?=[A-Z][a-z])|[A-Z][a-z]/', ' $0', $name)))));
    }

    /**
     * @param $input_spec
     * @param $input
     * @return mixed
     */
    private function processInput($input_spec, $input) {

        foreach($input_spec as $key => $val) {
            if(!array_key_exists($key, $input)) {
                continue;
            }
            $spec = $input_spec[$key];
            $type = $spec["type"];
            if($type === "array") {
                $input[$key] = $this->processInput($spec["input"], $input[$key]);
            } else if(($type === "date") || ($type === "datetime")) {
                if($input[$key]) {
                    $input[$key] = Carbon::createFromTimestampUTC($input[$key]);
                }
            } else if($type === "select") {

                foreach($spec["choices"] as $choice) {
                    if(($choice["value"] === $input[$key]) && array_key_exists("input", $choice)) {
                        $proc_input = array();
                        foreach($choice["input"] as $choice_key => $choice_val) {
                            $proc_input[$choice_key] = $input[$choice_key];
                        }
                        $choice_output = $this->processInput($choice["input"], $proc_input);
                        $input = array_merge($input, $choice_output);
                    }
                }

            } else if($type === "multientity") {

                $multi_input = $input[$key];

                $metadata = $this->em->getMetadataFactory()->getMetadataFor($spec["entity"]);
                $reflection = $metadata->getReflectionClass();
                $reader = new AnnotationReader();
                $class_admin = $reader->getClassAnnotation($reflection, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");

                if(!$this->hasPermission("entity", $class_admin)) {
                    continue;
                }
                $repo = $this->em->getRepository($spec["entity"]);

                if(array_key_exists("select_all", $multi_input)) {

                    $class_permission = $reader->getClassAnnotation($reflection, "Grigorygraborenko\\RecursiveAdmin\\Annotations\\Admin");
                    $qb = $repo->createQueryBuilder('e');
                    if(array_key_exists("filter", $multi_input)) {
                        $this->filterQuery($qb, $multi_input, $metadata, $reflection, $reader, $class_permission);
                    }
                    $entities = $qb->getQuery()->getResult();

                } else {

                    $criteria = array();
                    foreach($metadata->getIdentifierFieldNames() as $id_name) {
                        $id_list = array();
                        foreach($multi_input as $id_obj) {
                            if(array_key_exists($id_name, $id_obj)) {
                                $id_list[] = $id_obj[$id_name];
                            }
                        }
                        $criteria[$id_name] = $id_list;
                    }

                    $entities = $repo->findBy($criteria);
                }

                $input[$key] = $entities;
            }
        }
        return $input;
    }

    /**
     * @param $message
     * @param null $params
     * @return JsonResponse
     * @throws \Exception
     */
    private function respondError($message, $params = null) {
        $message = array(
            'result' => $message
            ,'status' => 400
            ,'data' => $params
        );

        $this->logger->error(var_export($message, true));

        $response = new JsonResponse();
        $response->setData($message);
        $response->setStatusCode(400);

        return $response;
    }
}