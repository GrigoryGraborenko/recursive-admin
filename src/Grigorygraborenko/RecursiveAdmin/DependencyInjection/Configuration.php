<?php

namespace Grigorygraborenko\RecursiveAdmin\DependencyInjection;

use Symfony\Component\Config\Definition\Builder\TreeBuilder;
use Symfony\Component\Config\Definition\ConfigurationInterface;

/**
 * This is the class that validates and merges configuration from your app/config files
 */
class Configuration implements ConfigurationInterface
{
    /**
     * {@inheritDoc}
     */
    public function getConfigTreeBuilder()
    {
        $treeBuilder = new TreeBuilder();
        $rootNode = $treeBuilder->root('recursive_admin');

        $rootNode
            ->children()
                ->arrayNode('default_permissions')->isRequired()
                    ->children()
                        ->arrayNode('entity')->info("User roles that can see all entities by default")->prototype('scalar')->end()->isRequired()->cannotBeEmpty()->end()
                        ->arrayNode('read')->info("User roles that can see all entity fields by default")->prototype('scalar')->end()->isRequired()->cannotBeEmpty()->end()
                        ->arrayNode('write')->info("User roles that can edit all entity fields by default")->prototype('scalar')->end()->isRequired()->cannotBeEmpty()->end()
                        ->arrayNode('create')->info("User roles that can create all entities by default")->prototype('scalar')->end()->isRequired()->cannotBeEmpty()->end()
                        ->arrayNode('destroy')->info("User roles that can delete all entities by default")->prototype('scalar')->end()->isRequired()->cannotBeEmpty()->end()
                    ->end()
                ->end()
                ->scalarNode("back_route")->cannotBeEmpty()->end()
                ->arrayNode("testing")
                    ->children()
                        ->booleanNode('allow_fake_data_creation')->defaultFalse()->end()
                        ->scalarNode('permission')->cannotBeEmpty()->isRequired()->end()
                    ->end()
                ->end()
                ->arrayNode('global_actions')->requiresAtLeastOneElement()->prototype('array')
                    ->children()
                        ->scalarNode('service')->isRequired()->end()
                        ->scalarNode('method')->isRequired()->end()
                    ->end()->end()
                ->end()
            ->end()
        ;
        return $treeBuilder;
    }
}
