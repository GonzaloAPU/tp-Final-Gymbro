<?php
/**
 * SmartGymBro Dashboard Plugin for MantisBT 2.x
 */

class SmartGymBroDashboardPlugin extends MantisPlugin {

	public function register() {
		$this->name        = 'SmartGymBro Dashboard';
		$this->description = 'Dashboard interactivo dentro de MantisBT con KPIs, graficos y seguimiento de severidad, urgencia y fecha limite.';
		$this->page        = '';
		$this->version     = '1.0.0';
		$this->requires    = array(
			'MantisCore' => '2.0.0',
		);
		$this->author      = 'SmartGymBro Team';
		$this->contact     = '';
		$this->url         = '';
	}

	public function hooks() {
		return array(
			'EVENT_MENU_MAIN_FRONT' => 'menu_main',
			'EVENT_LAYOUT_RESOURCES' => 'resources',
		);
	}

	public function menu_main() {
		return array(
			array(
				'title'        => 'Dashboard',
				'url'          => plugin_page( 'dashboard' ),
				'access_level' => VIEWER,
				'icon'         => 'fa-dashboard',
			),
		);
	}

	public function resources() {
		$t_page = gpc_get_string( 'page', '' );
		if( current( explode( '/', $t_page ) ) === $this->basename ) {
			echo "\t", '<link rel="stylesheet" type="text/css" href="' . plugin_file( 'dashboard.css' ) . '" />', "\n";
			echo "\t", '<script src="' . plugin_file( 'Chart.bundle-2.8.0.min.js' ) . '"></script>', "\n";
			echo "\t", '<script src="' . plugin_file( 'dashboard.js' ) . '"></script>', "\n";
		}
	}
}
