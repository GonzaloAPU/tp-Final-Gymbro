/* SmartGymBro MantisBT Dashboard Charts */
/* globals Chart, jQuery */
"use strict";

jQuery(document).ready(function ($) {
    function parseJsonAttr($el, attr) {
        var raw = $el.attr("data-" + attr);
        if (!raw) {
            return [];
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            return [];
        }
    }

    var palette = [
        "#3b82f6",
        "#10b981",
        "#f59e0b",
        "#ef4444",
        "#8b5cf6",
        "#06b6d4",
        "#ec4899",
        "#6366f1"
    ];

    // 1. Status Doughnut Chart
    var $statusCanvas = $("#sgb-chart-status");
    if ($statusCanvas.length) {
        var sLabels = parseJsonAttr($statusCanvas, "labels");
        var sValues = parseJsonAttr($statusCanvas, "values");
        var sColors = parseJsonAttr($statusCanvas, "colors");
        new Chart($statusCanvas, {
            type: "doughnut",
            data: {
                labels: sLabels.length ? sLabels : ["Sin datos"],
                datasets: [{
                    data: sValues.length ? sValues : [0],
                    backgroundColor: sColors.length ? sColors : palette,
                    borderColor: "#ffffff",
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: { position: "right" }
            }
        });
    }

    // 2. Category Bar Chart
    var $catCanvas = $("#sgb-chart-category");
    if ($catCanvas.length) {
        var cLabels = parseJsonAttr($catCanvas, "labels");
        var cValues = parseJsonAttr($catCanvas, "values");
        new Chart($catCanvas, {
            type: "bar",
            data: {
                labels: cLabels,
                datasets: [{
                    label: "Incidencias",
                    data: cValues,
                    backgroundColor: cLabels.map(function (_, i) {
                        return palette[i % palette.length];
                    }),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: { display: false },
                scales: {
                    yAxes: [{
                        ticks: { beginAtZero: true, stepSize: 1 }
                    }]
                }
            }
        });
    }

    // 3. Handler Horizontal Bar Chart
    var $handlerCanvas = $("#sgb-chart-handler");
    if ($handlerCanvas.length) {
        var hLabels = parseJsonAttr($handlerCanvas, "labels");
        var hValues = parseJsonAttr($handlerCanvas, "values");
        new Chart($handlerCanvas, {
            type: "horizontalBar",
            data: {
                labels: hLabels,
                datasets: [{
                    label: "Asignadas",
                    data: hValues,
                    backgroundColor: "#3b82f6",
                    borderColor: "#2563eb",
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: { display: false },
                scales: {
                    xAxes: [{
                        ticks: { beginAtZero: true, stepSize: 1 }
                    }]
                }
            }
        });
    }

    // 4. Custom Fields: Severidad vs Urgencia (1-5)
    var $customCanvas = $("#sgb-chart-custom");
    if ($customCanvas.length) {
        var cfLabels = parseJsonAttr($customCanvas, "labels");
        var cfSev = parseJsonAttr($customCanvas, "severidad");
        var cfUrg = parseJsonAttr($customCanvas, "urgencia");
        new Chart($customCanvas, {
            type: "bar",
            data: {
                labels: cfLabels,
                datasets: [
                    {
                        label: "Severidad (1-5)",
                        data: cfSev,
                        backgroundColor: "rgba(239, 68, 68, 0.8)",
                        borderColor: "#dc2626",
                        borderWidth: 1
                    },
                    {
                        label: "Urgencia (1-5)",
                        data: cfUrg,
                        backgroundColor: "rgba(245, 158, 11, 0.8)",
                        borderColor: "#d97706",
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    yAxes: [{
                        ticks: { beginAtZero: true, stepSize: 1 }
                    }]
                }
            }
        });
    }
});
