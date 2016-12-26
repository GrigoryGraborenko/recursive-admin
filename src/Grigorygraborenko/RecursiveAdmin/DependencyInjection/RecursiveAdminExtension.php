<?php

namespace Grigorygraborenko\RecursiveAdmin\DependencyInjection;

use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpKernel\DependencyInjection\ConfigurableExtension;

/**
 * Class RecursiveAdminExtension
 * @package RecursiveAdminBundle\DependencyInjection
 */
class RecursiveAdminExtension extends ConfigurableExtension
{
    /**
     * {@inheritDoc}
     */
    protected function loadInternal(array $mergedConfig, ContainerBuilder $container) {
        $container->setParameter("recursive_admin.config", $mergedConfig);
    }
}
