/*
 *  Copyright (c) 2017 B3Partners (info@b3partners.nl)
 *
 *  This file is part of safetymaps-viewer
 *
 *  safetymapDBK is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  safetymapDBK is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with safetymapDBK. If not, see <http://www.gnu.org/licenses/>.
 *
 */

/*
 * OpenLayers2 layers for displaying SafetyMaps Creator objects.
 *
 */

 /* global safetymaps, OpenLayers */

var safetymaps = safetymaps || {};
safetymaps.creator = safetymaps.creator || {};

safetymaps.creator.CreatorObjectLayers = function(options) {
    this.options = $.extend({
        compartmentLabelMinSegmentLength: 7.5,
        compartmentLabelMinScale: 300
    }, options);
};

safetymaps.creator.CreatorObjectLayers.prototype.scalePattern = function(pattern, factor) {
    if(!pattern || pattern.trim().length === 0) {
        return "";
    }
    var values = pattern.replace(/\s+/g, " ").split(" ");
    for(var i = 0; i < values.length; i++) {
        values[i] *= factor;
    }
    return values.join(" ");
};

safetymaps.creator.CreatorObjectLayers.prototype.createLayers = function() {
    var me = this;

    this.layers = [];

    this.layerBuildings = new OpenLayers.Layer.Vector("Creator buildings", {
        rendererOptions: {
            zIndexing: true
        },
        // TODO add VRH functionality for switching style when aerial basemap
        // is enabled
        styleMap: new OpenLayers.StyleMap({
            default: new OpenLayers.Style({
                fillColor: "#66ff66",
                fillOpacity: 0.2,
                strokeColor: "#66ff66",
                strokeWidth: 1
            }, {
                context: {
                }
            })
        })
    });
    this.layers.push(this.layerBuildings);

    this.layerCustomPolygon = new OpenLayers.Layer.Vector("Creator custom polygons", {
        rendererOptions: {
            zIndexing: true
        },
        styleMap: new OpenLayers.StyleMap({
            default: new OpenLayers.Style({
                fillColor: "${fillColor}",
                fillOpacity: "${fillOpacity}",
                strokeWidth: 0
            }, {
                context: {
                    fillColor: function(feature) {
                        return feature.attributes.style.color;
                    },
                    fillOpacity: function(feature) {
                        return feature.attributes.style.opacity;
                    }
                }
            })
        })
    });
    this.layers.push(this.layerCustomPolygon);

    this.layerFireCompartmentation = new OpenLayers.Layer.Vector("Creator fire compartmentation", {
        rendererOptions: {
            zIndexing: true
        },
        styleMap: new OpenLayers.StyleMap({
            default: new OpenLayers.Style({
                strokeColor: "${color}",
                strokeWidth: "${width}",
                strokeLinecap: "butt",
                strokeDashstyle: "${dashstyle}"
            }, {
                context: {
                    color: function(feature) {
                        return feature.attributes.style.color;
                    },
                    width: function(feature) {
                        // TODO: scaling
                        return feature.attributes.style.thickness;
                    },
                    dashstyle: function(feature) {
                        // TODO: scaling
                        return me.scalePattern(feature.attributes.style.pattern, 3);
                    }
                }
            })
        })
    });
    this.layers.push(this.layerFireCompartmentation);
    this.layerFireCompartmentationLabels = new OpenLayers.Layer.Vector("Creator fire compartmentation labels", {
        minScale: me.options.compartmentLabelMinScale,
        rendererOptions: {
            zIndexing: true
        },
        styleMap: new OpenLayers.StyleMap({
            'default': new OpenLayers.Style({
                fontSize: "${size}",
                label: "${label}",
                labelSelect: false,
                rotation: "${rotation}",
                labelOutlineColor: "#ffffff",
                labelOutlineWidth: 2,
                labelAlign: "cb",
                labelXOffset: "${labelXOffset}",
                labelYOffset: "${labelYOffset}",
            }, {
                context: {
                    size: function(feature) {
                        return 16;
                    },
                    label: function(feature) {
                        return feature.attributes.style[OpenLayers.Lang.getCode()];
                    },
                    labelYOffset: function(feature) {
                        return Math.sin(feature.attributes.theta + Math.PI/2) * 5;
                    },
                    labelXOffset: function(feature) {
                        return Math.cos(feature.attributes.theta + Math.PI/2) * 5;
                    }
                }
            })
        })
    });
    this.layers.push(this.layerFireCompartmentationLabels);

    this.layerLines1 = new OpenLayers.Layer.Vector("Creator lines 1", {
        rendererOptions: {
            zIndexing: true
        },
        styleMap: new OpenLayers.StyleMap({
            default: new OpenLayers.Style({
                strokeColor: "${color}",
                strokeDashstyle: "${dashstyle}",
                fillColor: "${color}",
                strokeWidth: "${strokeWidth}",
                graphicName: "${graphicName}",
                rotation: "${rotation}",
                pointRadius: 5,
                label: "${description}"
            }, {
                context: {
                    color: function(feature) {
                        return feature.attributes.style.color1;
                    },
                    strokeWidth: function(feature) {
                        var type = feature.attributes.style.type_viewer;
                        if(type === "doubletrack" || type === "tube") {
                            return feature.attributes.style.thickness + 2;
                        }
                    },
                    dashstyle: function(feature) {
                        return me.scalePattern(feature.attributes.style.pattern, 3);
                    },
                    graphicName: function(feature) {
                        if(feature.attributes.style.type_viewer === "arrow") {
                            return "triangle";
                            console.log("triangle");
                        }
                    },
                    rotation: function(feature) {
                        if(feature.attributes.lineAngle) {
                            // Subtract angle from 90 because triangle with 0 rotation is pointing north
                            return 90 - feature.attributes.lineAngle;
                        }
                        return 0;
                    }

                }
            })
        })
    });
    this.layers.push(this.layerLines1);
    this.layerLines2 = new OpenLayers.Layer.Vector("Creator lines 2", {
        rendererOptions: {
            zIndexing: true
        },
        styleMap: new OpenLayers.StyleMap({
            default: new OpenLayers.Style({
                strokeColor: "${color}",
                strokeLinecap: "butt",
                strokeWidth: "${strokeWidth}",
                strokeDashstyle: "${dashstyle}"
            }, {
                context: {
                    color: function(feature) {
                        return feature.attributes.style.color2;
                    },
                    strokeWidth: function(feature) {
                        return feature.attributes.style.thickness;
                    },
                    dashstyle: function(feature) {
                        if(feature.attributes.style.type_viewer === "tube") {
                            return me.scalePattern("8 8", 1);
                        }
                        return "";
                    }
                }
            })
        })
    });
    this.layers.push(this.layerLines2);
    this.layerLines3 = new OpenLayers.Layer.Vector("Creator lines 3", {
        rendererOptions: {
            zIndexing: true
        },
        styleMap: new OpenLayers.StyleMap({
            default: new OpenLayers.Style({
                strokeColor: "${color}",
                strokeWidth: "${strokeWidth}",
                strokeDashstyle: "${dashstyle}",
                strokeLinecap: "butt"
            }, {
                context: {
                    color: function(feature) {
                        return feature.attributes.style.color1;
                    },
                    strokeWidth: function(feature) {
                        return feature.attributes.style.thickness + 4;
                    },
                    dashstyle: function(feature) {
                        return me.scalePattern("1 20", 1);
                    }
                }
            })
        })
    });
    this.layers.push(this.layerLines3);

    this.layerApproachRoutes = new OpenLayers.Layer.Vector("Creator approach routes", {
        rendererOptions: {
            zIndexing: true
        },
        styleMap: new OpenLayers.StyleMap({
            default: new OpenLayers.Style({
                strokeColor: "${color}",
                fillColor: "${color}",
                strokeWidth: "${strokeWidth}",
                graphicName: "triangle",
                rotation: "${rotation}",
                pointRadius: 5
            }, {
                context: {
                    color: function(feature) {
                        return feature.attributes.primary ? "#ff0000" : "#00ff00";
                    },
                    strokeWidth: function(feature) {
                        return 1;
                    },
                    rotation: function(feature) {
                        if(feature.attributes.lineAngle) {
                            // Subtract angle from 90 because triangle with 0 rotation is pointing north
                            return 90 - feature.attributes.lineAngle;
                        }
                        return 0;
                    }
                }
            })
        })
    });
    this.layers.push(this.layerApproachRoutes);

    this.layerCommunicationCoverage = new OpenLayers.Layer.Vector("Creator communication coverage", {
        rendererOptions: {
            zIndexing: true
        },
        styleMap: new OpenLayers.StyleMap({
            default: new OpenLayers.Style({
                externalGraphic: "${symbol}",
                pointRadius: 14
            }, {
                context: {
                    symbol: function(feature) {
                        return safetymaps.creator.api.imagePath + (feature.attributes.coverage ? "" : "no_") + "coverage.png";
                    }
                }
            })
        })
    });
    this.layers.push(this.layerCommunicationCoverage);

    this.layerSymbols = new OpenLayers.Layer.Vector("Creator symbols", {
        rendererOptions: {
            zIndexing: true
        },
        styleMap: new OpenLayers.StyleMap({
            'default': new OpenLayers.Style({
                externalGraphic: "${symbol}",
                pointRadius: 14,
                rotation: "-${rotation}"
            }, {
                context: {
                    symbol: function(feature) {
                        var symbol = feature.attributes.code;
                        if(feature.attributes.description.trim().length > 0) {
                            symbol += "_i";
                        }
                        return safetymaps.creator.api.imagePath + 'symbols/' + symbol + '.png';
                    }
                }
            })
        })
    });
    this.layers.push(this.layerSymbols);

    this.layerDangerSymbols = new OpenLayers.Layer.Vector("Creator danger symbols", {
        rendererOptions: {
            zIndexing: true
        },
        styleMap: new OpenLayers.StyleMap({
            'default': new OpenLayers.Style({
                externalGraphic: safetymaps.creator.api.imagePath + "/danger_symbols/${symbol}.png",
                pointRadius: 14
            })
        })
    });
    this.layers.push(this.layerDangerSymbols);

    this.layerLabels = new OpenLayers.Layer.Vector("Creator labels", {
        rendererOptions: {
            zIndexing: true
        },
        styleMap: new OpenLayers.StyleMap({
            'default': new OpenLayers.Style({
                fontSize: "${size}",
                label: "${label}",
                rotation: "-${rotation}",
                labelOutlineColor: "#ffffff",
                labelOutlineWidth: 1
            }, {
                context: {
                    size: function(feature) {
                        return feature.attributes.size * 2;
                    }
                }
            })
        })
    });
    this.layers.push(this.layerLabels);

    return this.layers;
};

safetymaps.creator.CreatorObjectLayers.prototype.removeAllFeatures = function(object) {
    if(this.layers) {
        $.each(this.layers, function(i, layer) {
            layer.removeAllFeatures();
        });
    }
};

safetymaps.creator.CreatorObjectLayers.prototype.addFeaturesForObject = function(object) {
    this.addBuildingFeatures(object);
    this.addCustomPolygonFeatures(object);
    this.addFireCompartmentationFeatures(object);
    this.addLineFeatures(object);
    this.addApproachRouteFeatures(object);
    this.addCommunicationCoverageFeatures(object);
    this.addSymbolFeatures(object);
    this.addDangerSymbolFeatures(object);
    this.addLabelFeatures(object);
};

safetymaps.creator.CreatorObjectLayers.prototype.addBuildingFeatures = function(object) {
    var wktParser = new OpenLayers.Format.WKT();

    var features = [];
    $.each(object.buildings || [], function(i, buildingWkt) {
        var f = wktParser.read(buildingWkt);
        f.attributes.index = i;
        features.push(f);
    });
    this.layerBuildings.addFeatures(features);
    if(features.length > 0) console.log("added buildings", features);
};

safetymaps.creator.CreatorObjectLayers.prototype.addCustomPolygonFeatures = function(object) {
    var wktParser = new OpenLayers.Format.WKT();

    var features = [];
    $.each(object.custom_polygons || [], function(i, detail) {
        var f = wktParser.read(detail.polygon);
        f.attributes.index = i;
        f.attributes.description = detail.omschrijving;
        f.attributes.style = safetymaps.creator.api.styles.custom_polygons[detail.style];
        features.push(f);
    });
    this.layerCustomPolygon.addFeatures(features);
    if(features.length > 0) console.log("added custom polygons", features);
};

safetymaps.creator.CreatorObjectLayers.prototype.addFireCompartmentationFeatures = function(object) {
    var me = this;

    var wktParser = new OpenLayers.Format.WKT();

    var features = [];
    var labelFeatures = [];
    $.each(object.fire_compartmentation || [], function(i, detail) {
        var f = wktParser.read(detail.line);
        f.attributes.index = i;
        f.attributes.description = detail.omschrijving;
        f.attributes.style = safetymaps.creator.api.styles.compartments[detail.style];
        features.push(f);

        var line = f.geometry;

        // MultiLineString
        for(var j = 0; j < line.components.length; j++) {
            for(var k = 0; k < line.components[j].components.length-1; k++) {
                var start = line.components[j].components[k];
                var end = line.components[j].components[k+1];

                console.log("segment length " + start.distanceTo(end) + ", min " + me.options.compartmentLabelMinSegmentLength);
                if(start.distanceTo(end) < me.options.compartmentLabelMinSegmentLength) {
                    continue;
                }

                var midx = start.x + (end.x - start.x)/2;
                var midy = start.y + (end.y - start.y)/2;

                var opposite = (end.y - start.y);
                var adjacent = (end.x - start.x);
                var theta = Math.atan2(opposite, adjacent);
                var angle = -theta * (180/Math.PI);

                var labelPoint = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(midx, midy), {
                    index: i,
                    style: f.attributes.style,
                    rotation: angle,
                    theta: theta
                });
                labelFeatures.push(labelPoint);
            }
        }
    });
    this.layerFireCompartmentation.addFeatures(features);
    this.layerFireCompartmentationLabels.addFeatures(labelFeatures);
    if(features.length > 0) console.log("added fire compartmentation", features, labelFeatures);
};

safetymaps.creator.CreatorObjectLayers.prototype.addLineFeatures = function(object) {
    var wktParser = new OpenLayers.Format.WKT();

    var features1 = [];
    var features2 = [];
    var features3 = [];
    $.each(object.lines || [], function(i, detail) {
        var f = wktParser.read(detail.line);

        var style = safetymaps.creator.api.styles.custom_lines[detail.style];

        if(style.type_viewer === "arrow") {
            // Create two geometries: one line and a point at the end of the
            // line to display the arrow
            var vertices = f.geometry.getVertices();
            var end = vertices[vertices.length - 1];

            // Rotation for triangle graphic rendered at end of line
            f.attributes.lineAngle = safetymaps.utils.geometry.getLastLineSegmentAngle(f.geometry);

            f.geometry = new OpenLayers.Geometry.Collection([f.geometry, end]);
        }

        f.attributes.index = i;
        f.attributes.description = detail.omschrijving;
        f.attributes.style = style;
        features1.push(f);

        if(style.type_viewer === "doubletrack" || style.type_viewer === "tube") {
            features2.push(f.clone());
        }
        if(style.type_viewer === "track" || style.type_viewer === "doubletrack") {
            features3.push(f.clone());
        }
    });
    this.layerLines1.addFeatures(features1);
    this.layerLines2.addFeatures(features2);
    this.layerLines3.addFeatures(features3);
    if(features1.length > 0) console.log("added lines", features1, features2, features3);
};

safetymaps.creator.CreatorObjectLayers.prototype.addApproachRouteFeatures = function(object) {
    var wktParser = new OpenLayers.Format.WKT();

    var features = [];
    $.each(object.approach_routes || [], function(i, detail) {
        var f = wktParser.read(detail.line);
        f.attributes.index = i;
        f.attributes.description = detail.omschrijving;
        f.attributes.name = detail.naam;
        f.attributes.primary = detail.primair;

        // Create two geometries: one line and a point at the end of the
        // line to display the arrow
        var vertices = f.geometry.getVertices();
        var end = vertices[vertices.length - 1];

        // Rotation for triangle graphic rendered at end of line
        f.attributes.lineAngle = safetymaps.utils.geometry.getLastLineSegmentAngle(f.geometry);

        f.geometry = new OpenLayers.Geometry.Collection([f.geometry, end]);
        features.push(f);
    });
    this.layerApproachRoutes.addFeatures(features);
    if(features.length > 0) console.log("added approach routes", features);
};

safetymaps.creator.CreatorObjectLayers.prototype.addCommunicationCoverageFeatures = function(object) {
    var wktParser = new OpenLayers.Format.WKT();

    var features = [];
    $.each(object.communication_coverage || [], function(i, detail) {
        var f = wktParser.read(detail.location);
        f.attributes.index = i;
        f.attributes.info = detail.aanvullende_informatie;
        f.attributes.coverage = detail.dekking;
        f.attributes.alternative = detail.alternatief;
        features.push(f);
    });
    this.layerCommunicationCoverage.addFeatures(features);
    if(features.length > 0) console.log("added communication coverage", features);
};

safetymaps.creator.CreatorObjectLayers.prototype.addSymbolFeatures = function(object) {
    var wktParser = new OpenLayers.Format.WKT();

    var features = [];
    $.each(object.symbols || [], function(i, detail) {
        var f = wktParser.read(detail.location);
        f.attributes.index = i;
        f.attributes.description = detail.omschrijving;
        f.attributes.rotation = detail.rotation;
        f.attributes.code = detail.code;
        features.push(f);
    });
    this.layerSymbols.addFeatures(features);
    if(features.length > 0) console.log("added symbols", features);
};

safetymaps.creator.CreatorObjectLayers.prototype.addDangerSymbolFeatures = function(object) {
    var wktParser = new OpenLayers.Format.WKT();

    var features = [];
    $.each(object.danger_symbols || [], function(i, detail) {
        var f = wktParser.read(detail.location);
        f.attributes.index = i;
        f.attributes.description = detail.omschrijving;
        f.attributes.symbol = detail.symbol;
        f.attributes.geviCode = detail.gevi_code;
        f.attributes.unNr = detail.un_nr;
        f.attributes.amount = detail.hoeveelheid;
        f.attributes.substance_name = detail.naam_stof;
        features.push(f);
    });
    this.layerDangerSymbols.addFeatures(features);
    if(features.length > 0) console.log("added danger symbols", features);
};

safetymaps.creator.CreatorObjectLayers.prototype.addLabelFeatures = function(object) {
    var wktParser = new OpenLayers.Format.WKT();

    var features = [];
    $.each(object.labels || [], function(i, detail) {
        var f = wktParser.read(detail.location);
        f.attributes.index = i;
        f.attributes.label = detail.text;
        f.attributes.rotation = detail.rotation;
        f.attributes.size = detail.size;
        features.push(f);
    });
    this.layerLabels.addFeatures(features);
    if(features.length > 0) console.log("added labels", features);
};
