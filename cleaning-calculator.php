<?php
/**
 * Plugin Name: Калькулятор вартості прибирання
 * Plugin URI:  https://github.com/MaKsImKa22/cleaning-calculator
 * Description: Інтерактивний калькулятор вартості прибирання. Шорткод [cleaning_calculator]. Заявки з калькулятора зберігаються в адмінці.
 * Version:     1.0.0
 * Author:      MaKsImKa22
 * License:     GPL-2.0-or-later
 * Requires PHP: 7.4
 *
 * @package cleaning-calculator
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CLEANING_CALC_VERSION', '1.0.0' );

/**
 * Тип запису для заявок. Якщо тема «Чисто Луцьк» уже має «Заявки» (lead) — пишемо туди,
 * інакше реєструємо власний розділ.
 *
 * @return string
 */
function cleaning_calc_post_type() {
	return post_type_exists( 'lead' ) ? 'lead' : 'cc_request';
}

add_action(
	'init',
	function () {
		if ( post_type_exists( 'lead' ) ) {
			return;
		}
		register_post_type(
			'cc_request',
			array(
				'labels'       => array(
					'name'          => 'Заявки з калькулятора',
					'singular_name' => 'Заявка з калькулятора',
				),
				'public'       => false,
				'show_ui'      => true,
				'menu_icon'    => 'dashicons-calculator',
				'supports'     => array( 'title', 'editor' ),
				'capabilities' => array( 'create_posts' => 'do_not_allow' ),
				'map_meta_cap' => true,
			)
		);
	},
	20
);

add_action(
	'wp_enqueue_scripts',
	function () {
		wp_register_style( 'cleaning-calculator', plugins_url( 'calculator.css', __FILE__ ), array(), CLEANING_CALC_VERSION );
		wp_register_script( 'cleaning-calculator', plugins_url( 'calculator.js', __FILE__ ), array(), CLEANING_CALC_VERSION, true );
	}
);

add_shortcode(
	'cleaning_calculator',
	function () {
		wp_enqueue_style( 'cleaning-calculator' );
		wp_enqueue_script( 'cleaning-calculator' );

		/**
		 * Налаштування калькулятора: ціни, знижки, мінімальне замовлення.
		 * Формат — як DEFAULT_CONFIG у calculator.js; передані ключі замінюють стандартні.
		 */
		$config = apply_filters(
			'cleaning_calculator_config',
			array(
				'endpoint'    => admin_url( 'admin-ajax.php' ),
				'extraFields' => array(
					'action' => 'cleaning_calculator_lead',
					'nonce'  => wp_create_nonce( 'cleaning_calculator_lead' ),
				),
			)
		);

		return sprintf( '<div data-cleaning-calculator data-config="%s"></div>', esc_attr( wp_json_encode( $config ) ) );
	}
);

/**
 * Приймає заявку з калькулятора.
 */
function cleaning_calc_handle_lead() {
	if ( ! check_ajax_referer( 'cleaning_calculator_lead', 'nonce', false ) ) {
		wp_send_json_error( array( 'message' => 'Сторінка застаріла, оновіть її.' ), 403 );
	}

	$name    = isset( $_POST['name'] ) ? sanitize_text_field( wp_unslash( $_POST['name'] ) ) : '';
	$phone   = isset( $_POST['phone'] ) ? sanitize_text_field( wp_unslash( $_POST['phone'] ) ) : '';
	$total   = isset( $_POST['total'] ) ? absint( $_POST['total'] ) : 0;
	$summary = isset( $_POST['summary'] ) ? sanitize_textarea_field( wp_unslash( $_POST['summary'] ) ) : '';
	$digits  = preg_replace( '/\D/', '', $phone );

	if ( '' === $name || strlen( $digits ) < 10 || strlen( $digits ) > 13 ) {
		wp_send_json_error( array( 'message' => 'Перевірте ім’я та телефон.' ), 400 );
	}

	$service = sprintf( 'Калькулятор: %s грн', number_format( $total, 0, '', ' ' ) );
	$source  = wp_get_referer() ? wp_get_referer() : home_url( '/' );

	$lead_id = wp_insert_post(
		array(
			'post_type'    => cleaning_calc_post_type(),
			'post_status'  => 'private',
			'post_title'   => $name . ' — ' . $phone,
			'post_content' => $summary,
			'meta_input'   => array(
				'name'    => $name,
				'phone'   => $phone,
				'service' => $service,
				'message' => $summary,
				'source'  => $source,
			),
		)
	);

	if ( ! $lead_id || is_wp_error( $lead_id ) ) {
		wp_send_json_error( array( 'message' => 'Не вдалося зберегти заявку.' ), 500 );
	}

	wp_mail(
		get_option( 'admin_email' ),
		'Заявка з калькулятора: ' . $name,
		sprintf( "Ім’я: %s\nТелефон: %s\n\n%s\n\nСторінка: %s", $name, $phone, $summary, $source )
	);

	wp_send_json_success( array( 'id' => $lead_id ) );
}
add_action( 'wp_ajax_cleaning_calculator_lead', 'cleaning_calc_handle_lead' );
add_action( 'wp_ajax_nopriv_cleaning_calculator_lead', 'cleaning_calc_handle_lead' );
