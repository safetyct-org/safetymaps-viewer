/*
 * Copyright (c) 2019 B3Partners (info@b3partners.nl)
 *
 * This file is part of safetymaps-viewer.
 *
 * safetymaps-viewer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * safetymaps-viewer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 *  along with safetymaps-viewer. If not, see <http://www.gnu.org/licenses/>.
 */

/* global dbkjs, safetymaps, OpenLayers, Proj4js, jsts, moment, i18n, Mustache, PDFObject */

var dbkjs = dbkjs || {};
window.dbkjs = dbkjs;
dbkjs.modules = dbkjs.modules || {};

dbkjs.modules.drawing = {
    id: "dbk.modules.drawing",
    active: false,
    layer: null,
    drawLineControl: null,
    register: function() {
        var me = dbkjs.modules.drawing;

        me.options = $.extend({
            showMeasureButtons: false,
            // Set by ViewerApiActionBean
            editAuthorized: false,
            colors: ["yellow", "green", "red", "rgb(45,45,255)", "black"],
            defaultColor: "black"
        }, me.options);

        me.color = me.options.defaultColor;

        me.createElements();

        me.initOpenLayersControls();

        $(dbkjs).on("deactivate_exclusive_map_controls", function() {
            me.drawLineControl.deactivate();
        });
    },

    createElements: function() {
        var me = this;

        me.button = $("<a>")
            .attr("id", "btn-drawing")
            .attr("title", i18n.t("drawing.title"))
            .addClass("btn btn-default");
        $("<i/>").addClass("fa fa-pencil-square-o").appendTo(me.button);
        me.button.prependTo($("#bottom_left_buttons"));
        me.button.on("click", me.click.bind(me));

        me.panel = new DrawingPanelWindow(me.options);

        $(me.panel).on("hide", function() {
            me.active = false;
            me.deactivate();
        })
        .on("select", function() {
            me.selectMode();
        })
        .on("color", function(e, color) {
            me.drawLine(color);
        });
    },

    initOpenLayersControls: function() {
        var me = this;

        me.layer = new OpenLayers.Layer.Vector("_Drawing", {
            styleMap: new OpenLayers.StyleMap({
                "default": new OpenLayers.Style({
                    strokeColor: "${strokeColor}",
                    strokeWidth: "2",
                }/*, {
                    context: {
                        strokeColor: function(feature) {
                            return feature.attributes.strokeColor;
                        }
                    }
                }*/),
                "select": new OpenLayers.Style({
                    strokeWidth: "4"
                }),
                "hover": new OpenLayers.Style({
                    strokeWidth: "3"
                })
            })
        });
        dbkjs.map.addLayer(me.layer);

        me.drawLineControl = new OpenLayers.Control.DrawFeature(me.layer, OpenLayers.Handler.Path, {
            eventListeners: {
                featureadded: function(evt) {
                    console.log("featureadded", evt);
                    evt.feature.attributes.strokeColor = me.color;
                    me.layer.redraw();
                }
            },
            handlerOptions: {
                freehand: true,
                freehandToggle: null
            }
        });
        dbkjs.map.addControl(me.drawLineControl);
        me.drawLineControl.deactivate();
    },

    click: function() {
        if(this.active) {
            this.active = false;
            this.deactivate();
        } else {
            this.active = true;
            this.color = this.options.defaultColor;
            this.activate();
        }
    },

    activate: function() {
        this.panel.show();
        this.panel.unselectColor();
        $(dbkjs).triggerHandler("deactivate_exclusive_map_controls");
        this.drawLineControl.activate();
    },

    deactivate: function() {
        this.panel.hide();
        this.drawLineControl.deactivate();
    },

    selectMode: function() {
        this.drawLineControl.deactivate();
    },

    drawLine: function(color) {
        this.color = color;
        $(dbkjs).triggerHandler("deactivate_exclusive_map_controls");
        this.drawLineControl.activate();
    }
};