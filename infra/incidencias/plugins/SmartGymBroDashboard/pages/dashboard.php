<?php
auth_ensure_user_authenticated();

require_api( 'access_api.php' );
require_api( 'bug_api.php' );
require_api( 'category_api.php' );
require_api( 'custom_field_api.php' );
require_api( 'database_api.php' );
require_api( 'helper_api.php' );
require_api( 'html_api.php' );
require_api( 'lang_api.php' );
require_api( 'layout_api.php' );
require_api( 'project_api.php' );
require_api( 'string_api.php' );
require_api( 'user_api.php' );

$t_user_id       = auth_get_current_user_id();
$t_project_id    = helper_get_current_project();
$t_view_thresh   = config_get( 'view_bug_threshold' );
$t_priv_thresh   = config_get( 'private_bug_threshold' );
$t_resolved_val  = config_get( 'bug_resolved_status_threshold' );
$t_is_supervisor = ( ALL_PROJECTS == $t_project_id )
	? access_has_global_level( $t_priv_thresh, $t_user_id )
	: access_has_project_level( $t_priv_thresh, $t_project_id, $t_user_id );

# Custom field IDs
$t_cf_severidad_id    = custom_field_get_id_from_name( 'severidad' );
$t_cf_urgencia_id     = custom_field_get_id_from_name( 'urgencia' );
$t_cf_fecha_limite_id = custom_field_get_id_from_name( 'fecha_limite' );

# Query candidate bugs
if( ALL_PROJECTS == $t_project_id ) {
	$t_project_ids = user_get_accessible_projects( $t_user_id );
} else {
	$t_project_ids = array( $t_project_id );
}

$t_visible_bugs = array();
if( !empty( $t_project_ids ) ) {
	db_param_push();
	$t_param_list = array();
	$t_param_vals = array();
	foreach( $t_project_ids as $t_pid ) {
		$t_param_list[] = db_param();
		$t_param_vals[] = (int)$t_pid;
	}
	$t_placeholders = implode( ',', $t_param_list );
	$t_query = "SELECT id, project_id, reporter_id, handler_id, status, priority, severity, category_id, view_state, summary, date_submitted, last_updated
		FROM {bug}
		WHERE project_id IN ($t_placeholders)
		ORDER BY last_updated DESC, id DESC";
	$t_result = db_query( $t_query, $t_param_vals );
	while( $t_row = db_fetch_array( $t_result ) ) {
		$t_bug_id = (int)$t_row['id'];
		if( !access_has_bug_level( $t_view_thresh, $t_bug_id, $t_user_id ) ) {
			continue;
		}
		$t_row['cf_severidad']    = $t_cf_severidad_id ? custom_field_get_value( $t_cf_severidad_id, $t_bug_id ) : '';
		$t_row['cf_urgencia']     = $t_cf_urgencia_id ? custom_field_get_value( $t_cf_urgencia_id, $t_bug_id ) : '';
		$t_row['cf_fecha_limite'] = $t_cf_fecha_limite_id ? custom_field_get_value( $t_cf_fecha_limite_id, $t_bug_id ) : '';
		$t_visible_bugs[] = $t_row;
	}
}

# Aggregations
$t_total         = count( $t_visible_bugs );
$t_open          = 0;
$t_closed_res    = 0;
$t_high_crit     = 0;
$t_overdue       = 0;
$t_due_soon      = 0;
$t_today_start   = strtotime( date( 'Y-m-d 00:00:00' ) );
$t_soon_limit    = strtotime( '+3 days', $t_today_start );

$t_by_status     = array();
$t_status_colors = array();
$t_by_category   = array();
$t_by_handler    = array();
$t_sev_dist      = array( '1' => 0, '2' => 0, '3' => 0, '4' => 0, '5' => 0 );
$t_urg_dist      = array( '1' => 0, '2' => 0, '3' => 0, '4' => 0, '5' => 0 );

foreach( $t_visible_bugs as &$t_bug ) {
	$t_status = (int)$t_bug['status'];
	$t_is_open = ( $t_status < $t_resolved_val );
	if( $t_is_open ) {
		$t_open++;
	} else {
		$t_closed_res++;
	}

	# Status label & color
	$t_status_label = get_enum_element( 'status', $t_status );
	if( !isset( $t_by_status[$t_status_label] ) ) {
		$t_by_status[$t_status_label] = 0;
		$t_status_colors[$t_status_label] = get_status_color( $t_status, $t_user_id, (int)$t_bug['project_id'] );
	}
	$t_by_status[$t_status_label]++;

	# Category
	$t_cat_name = category_full_name( (int)$t_bug['category_id'], false );
	if( empty( $t_cat_name ) ) {
		$t_cat_name = 'Sin categoria';
	}
	$t_bug['category_name'] = $t_cat_name;
	if( !isset( $t_by_category[$t_cat_name] ) ) {
		$t_by_category[$t_cat_name] = 0;
	}
	$t_by_category[$t_cat_name]++;

	# Handler
	$t_hid = (int)$t_bug['handler_id'];
	if( $t_hid > 0 && user_exists( $t_hid ) ) {
		$t_real = user_get_field( $t_hid, 'realname' );
		$t_hname = !empty( $t_real ) ? $t_real : user_get_name( $t_hid );
	} else {
		$t_hname = 'Sin asignar';
	}
	$t_bug['handler_name'] = $t_hname;
	if( !isset( $t_by_handler[$t_hname] ) ) {
		$t_by_handler[$t_hname] = 0;
	}
	$t_by_handler[$t_hname]++;

	# Custom fields: severidad & urgencia
	$t_sev_val = trim( (string)$t_bug['cf_severidad'] );
	$t_urg_val = trim( (string)$t_bug['cf_urgencia'] );
	if( isset( $t_sev_dist[$t_sev_val] ) ) {
		$t_sev_dist[$t_sev_val]++;
	}
	if( isset( $t_urg_dist[$t_urg_val] ) ) {
		$t_urg_dist[$t_urg_val]++;
	}
	if( ( is_numeric( $t_sev_val ) && (int)$t_sev_val >= 4 ) || ( is_numeric( $t_urg_val ) && (int)$t_urg_val >= 4 ) ) {
		$t_high_crit++;
	}

	# Custom field: fecha_limite (Mantis DATE stores unix timestamp)
	$t_fl_raw = $t_bug['cf_fecha_limite'];
	$t_bug['fecha_limite_fmt']   = '-';
	$t_bug['fecha_limite_state'] = 'none';
	if( is_numeric( $t_fl_raw ) && (int)$t_fl_raw > 0 ) {
		$t_ts = (int)$t_fl_raw;
		$t_bug['fecha_limite_fmt'] = date( 'Y-m-d', $t_ts );
		if( $t_is_open ) {
			if( $t_ts < $t_today_start ) {
				$t_overdue++;
				$t_bug['fecha_limite_state'] = 'overdue';
			} elseif( $t_ts <= $t_soon_limit ) {
				$t_due_soon++;
				$t_bug['fecha_limite_state'] = 'soon';
			} else {
				$t_bug['fecha_limite_state'] = 'ok';
			}
		} else {
			$t_bug['fecha_limite_state'] = 'done';
		}
	}
}
unset( $t_bug );

arsort( $t_by_category );
arsort( $t_by_handler );

$t_resolution_pct = $t_total > 0 ? round( ( $t_closed_res / $t_total ) * 100 ) : 0;
$t_current_user_label = user_get_field( $t_user_id, 'realname' );
if( empty( $t_current_user_label ) ) {
	$t_current_user_label = user_get_name( $t_user_id );
}

layout_page_header( 'Dashboard - SmartGymBro' );
layout_page_begin( plugin_page( 'dashboard' ) );
?>

<div class="col-md-12 col-xs-12 sgb-dashboard">
	<!-- Header -->
	<div class="sgb-header clearfix">
		<div class="pull-left">
			<h3 class="sgb-title">
				<i class="fa fa-dashboard"></i>
				Dashboard de Incidencias &mdash; SmartGymBro
			</h3>
			<p class="sgb-subtitle">
				Usuario: <strong><?php echo string_display_line( $t_current_user_label ); ?></strong>
				<?php if( $t_is_supervisor ) { ?>
					<span class="label label-info arrowed-in-right arrowed">
						<i class="fa fa-eye"></i> Vista Supervisor: todas las incidencias del proyecto
					</span>
				<?php } else { ?>
					<span class="label label-warning arrowed-in-right arrowed">
						<i class="fa fa-lock"></i> Vista Restringida: solo tus incidencias asignadas / reportadas
					</span>
				<?php } ?>
			</p>
		</div>
		<div class="pull-right sgb-actions">
			<a class="btn btn-sm btn-primary btn-round" href="<?php echo helper_mantis_url( 'bug_report_page.php' ); ?>">
				<i class="fa fa-plus"></i> Reportar incidencia
			</a>
			<a class="btn btn-sm btn-default btn-white btn-round" href="<?php echo helper_mantis_url( 'view_all_bug_page.php' ); ?>">
				<i class="fa fa-list-alt"></i> Ver incidencias
			</a>
		</div>
	</div>

	<div class="space-8"></div>

	<!-- KPI Cards -->
	<div class="row sgb-kpi-row">
		<div class="col-lg-2 col-md-4 col-sm-6 col-xs-12">
			<div class="sgb-kpi-card sgb-kpi-blue">
				<div class="sgb-kpi-icon"><i class="fa fa-bug"></i></div>
				<div class="sgb-kpi-body">
					<div class="sgb-kpi-value"><?php echo (int)$t_total; ?></div>
					<div class="sgb-kpi-label">Incidencias visibles</div>
				</div>
			</div>
		</div>
		<div class="col-lg-2 col-md-4 col-sm-6 col-xs-12">
			<div class="sgb-kpi-card sgb-kpi-orange">
				<div class="sgb-kpi-icon"><i class="fa fa-folder-open"></i></div>
				<div class="sgb-kpi-body">
					<div class="sgb-kpi-value"><?php echo (int)$t_open; ?></div>
					<div class="sgb-kpi-label">Abiertas / Activas</div>
				</div>
			</div>
		</div>
		<div class="col-lg-2 col-md-4 col-sm-6 col-xs-12">
			<div class="sgb-kpi-card sgb-kpi-green">
				<div class="sgb-kpi-icon"><i class="fa fa-check-circle"></i></div>
				<div class="sgb-kpi-body">
					<div class="sgb-kpi-value"><?php echo (int)$t_closed_res; ?> <small>(<?php echo (int)$t_resolution_pct; ?>%)</small></div>
					<div class="sgb-kpi-label">Resueltas / Cerradas</div>
				</div>
			</div>
		</div>
		<div class="col-lg-3 col-md-6 col-sm-6 col-xs-12">
			<div class="sgb-kpi-card sgb-kpi-red">
				<div class="sgb-kpi-icon"><i class="fa fa-exclamation-triangle"></i></div>
				<div class="sgb-kpi-body">
					<div class="sgb-kpi-value"><?php echo (int)$t_high_crit; ?></div>
					<div class="sgb-kpi-label">Alta Criticidad (Sev/Urg &ge; 4)</div>
				</div>
			</div>
		</div>
		<div class="col-lg-3 col-md-6 col-sm-12 col-xs-12">
			<div class="sgb-kpi-card sgb-kpi-purple">
				<div class="sgb-kpi-icon"><i class="fa fa-calendar-times-o"></i></div>
				<div class="sgb-kpi-body">
					<div class="sgb-kpi-value"><?php echo (int)$t_overdue; ?> <small>venc. / <?php echo (int)$t_due_soon; ?> pr&oacute;x.</small></div>
					<div class="sgb-kpi-label">Control Fecha L&iacute;mite</div>
				</div>
			</div>
		</div>
	</div>

	<div class="space-10"></div>

	<!-- Charts Row 1 -->
	<div class="row">
		<div class="col-md-6 col-xs-12">
			<div class="widget-box widget-color-blue2">
				<div class="widget-header widget-header-small">
					<h4 class="widget-title lighter">
						<i class="ace-icon fa fa-pie-chart"></i> Incidencias por Estado
					</h4>
				</div>
				<div class="widget-body">
					<div class="widget-main sgb-chart-wrap">
						<canvas id="sgb-chart-status"
							data-labels="<?php echo string_attribute( json_encode( array_keys( $t_by_status ) ) ); ?>"
							data-values="<?php echo string_attribute( json_encode( array_values( $t_by_status ) ) ); ?>"
							data-colors="<?php echo string_attribute( json_encode( array_values( $t_status_colors ) ) ); ?>">
						</canvas>
					</div>
				</div>
			</div>
		</div>

		<div class="col-md-6 col-xs-12">
			<div class="widget-box widget-color-blue2">
				<div class="widget-header widget-header-small">
					<h4 class="widget-title lighter">
						<i class="ace-icon fa fa-bar-chart"></i> Incidencias por Categor&iacute;a
					</h4>
				</div>
				<div class="widget-body">
					<div class="widget-main sgb-chart-wrap">
						<canvas id="sgb-chart-category"
							data-labels="<?php echo string_attribute( json_encode( array_keys( $t_by_category ) ) ); ?>"
							data-values="<?php echo string_attribute( json_encode( array_values( $t_by_category ) ) ); ?>">
						</canvas>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="space-8"></div>

	<!-- Charts Row 2 -->
	<div class="row">
		<div class="col-md-6 col-xs-12">
			<div class="widget-box widget-color-blue2">
				<div class="widget-header widget-header-small">
					<h4 class="widget-title lighter">
						<i class="ace-icon fa fa-users"></i> Carga por Responsable (Asignado a)
					</h4>
				</div>
				<div class="widget-body">
					<div class="widget-main sgb-chart-wrap">
						<canvas id="sgb-chart-handler"
							data-labels="<?php echo string_attribute( json_encode( array_keys( $t_by_handler ) ) ); ?>"
							data-values="<?php echo string_attribute( json_encode( array_values( $t_by_handler ) ) ); ?>">
						</canvas>
					</div>
				</div>
			</div>
		</div>

		<div class="col-md-6 col-xs-12">
			<div class="widget-box widget-color-blue2">
				<div class="widget-header widget-header-small">
					<h4 class="widget-title lighter">
						<i class="ace-icon fa fa-sliders"></i> Campos Personalizados: Severidad vs Urgencia (1 al 5)
					</h4>
				</div>
				<div class="widget-body">
					<div class="widget-main sgb-chart-wrap">
						<canvas id="sgb-chart-custom"
							data-labels="<?php echo string_attribute( json_encode( array( 'Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4', 'Nivel 5' ) ) ); ?>"
							data-severidad="<?php echo string_attribute( json_encode( array_values( $t_sev_dist ) ) ); ?>"
							data-urgencia="<?php echo string_attribute( json_encode( array_values( $t_urg_dist ) ) ); ?>">
						</canvas>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="space-10"></div>

	<!-- Detailed Issues Table -->
	<div class="widget-box widget-color-blue2">
		<div class="widget-header widget-header-small">
			<h4 class="widget-title lighter">
				<i class="ace-icon fa fa-table"></i> Detalle de Incidencias (con Severidad, Urgencia y Fecha L&iacute;mite)
			</h4>
		</div>
		<div class="widget-body">
			<div class="widget-main no-padding">
				<div class="table-responsive">
					<table class="table table-striped table-bordered table-hover table-condensed sgb-table">
						<thead>
							<tr>
								<th>ID</th>
								<th>Resumen</th>
								<th>Categor&iacute;a</th>
								<th>Asignado a</th>
								<th>Estado</th>
								<th class="center">Severidad (1-5)</th>
								<th class="center">Urgencia (1-5)</th>
								<th class="center">Fecha L&iacute;mite</th>
								<th class="center">Visibilidad</th>
							</tr>
						</thead>
						<tbody>
							<?php if( empty( $t_visible_bugs ) ) { ?>
								<tr>
									<td colspan="9" class="center text-muted" style="padding:20px;">
										No hay incidencias visibles para este usuario en el proyecto seleccionado.
									</td>
								</tr>
							<?php } else { ?>
								<?php foreach( $t_visible_bugs as $t_bug ) {
									$t_id = (int)$t_bug['id'];
									$t_scolor = get_status_color( (int)$t_bug['status'], $t_user_id, (int)$t_bug['project_id'] );
									$t_slabel = get_enum_element( 'status', (int)$t_bug['status'] );
									$t_sev = trim( (string)$t_bug['cf_severidad'] );
									$t_urg = trim( (string)$t_bug['cf_urgencia'] );
									$t_sev_cls = ( is_numeric( $t_sev ) && (int)$t_sev >= 4 ) ? 'label-danger' : ( ( is_numeric( $t_sev ) && (int)$t_sev == 3 ) ? 'label-warning' : 'label-default' );
									$t_urg_cls = ( is_numeric( $t_urg ) && (int)$t_urg >= 4 ) ? 'label-danger' : ( ( is_numeric( $t_urg ) && (int)$t_urg == 3 ) ? 'label-warning' : 'label-default' );
									$t_fl_cls  = 'label-default';
									if( $t_bug['fecha_limite_state'] === 'overdue' ) {
										$t_fl_cls = 'label-danger';
									} elseif( $t_bug['fecha_limite_state'] === 'soon' ) {
										$t_fl_cls = 'label-warning';
									} elseif( $t_bug['fecha_limite_state'] === 'ok' ) {
										$t_fl_cls = 'label-info';
									} elseif( $t_bug['fecha_limite_state'] === 'done' ) {
										$t_fl_cls = 'label-success';
									}
								?>
								<tr>
									<td>
										<a href="<?php echo helper_mantis_url( 'view.php?id=' . $t_id ); ?>">
											<strong>#<?php echo bug_format_id( $t_id ); ?></strong>
										</a>
									</td>
									<td>
										<a href="<?php echo helper_mantis_url( 'view.php?id=' . $t_id ); ?>">
											<?php echo string_display_line( $t_bug['summary'] ); ?>
										</a>
									</td>
									<td><?php echo string_display_line( $t_bug['category_name'] ); ?></td>
									<td><?php echo string_display_line( $t_bug['handler_name'] ); ?></td>
									<td>
										<span class="sgb-status-dot" style="background-color:<?php echo string_attribute( $t_scolor ); ?>;"></span>
										<?php echo string_display_line( $t_slabel ); ?>
									</td>
									<td class="center">
										<?php if( $t_sev !== '' ) { ?>
											<span class="label <?php echo $t_sev_cls; ?>"><?php echo string_display_line( $t_sev ); ?> / 5</span>
										<?php } else { ?>
											<span class="text-muted">&mdash;</span>
										<?php } ?>
									</td>
									<td class="center">
										<?php if( $t_urg !== '' ) { ?>
											<span class="label <?php echo $t_urg_cls; ?>"><?php echo string_display_line( $t_urg ); ?> / 5</span>
										<?php } else { ?>
											<span class="text-muted">&mdash;</span>
										<?php } ?>
									</td>
									<td class="center">
										<?php if( $t_bug['fecha_limite_fmt'] !== '-' ) { ?>
											<span class="label <?php echo $t_fl_cls; ?>">
												<i class="fa fa-calendar"></i> <?php echo string_display_line( $t_bug['fecha_limite_fmt'] ); ?>
											</span>
										<?php } else { ?>
											<span class="text-muted">&mdash;</span>
										<?php } ?>
									</td>
									<td class="center">
										<?php if( (int)$t_bug['view_state'] === VS_PRIVATE ) { ?>
											<span class="label label-inverse" title="Privada"><i class="fa fa-lock"></i> Privada</span>
										<?php } else { ?>
											<span class="label label-light" title="Restringida por rol"><i class="fa fa-shield"></i> Controlada</span>
										<?php } ?>
									</td>
								</tr>
								<?php } ?>
							<?php } ?>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</div>

<?php
layout_page_end();
