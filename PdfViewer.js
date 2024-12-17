sap.ui.define(["sap/ui/core/Control",
	"./ControlUtils",
	"sap/ui/model/json/JSONModel",
	"pdfjs-dist/pdf"
], function(Control, ControlUtils, JSONModel,pdf) {
	"use strict";
	return Control.extend("cc.pdfviewer.PdfViewer", {
		"metadata": {
			"properties": {
				"pdfSource": "string",
				"height": "string",
				"currentPage": "string",
				"totalPages": "string",
				"startPage": "string",
				"endPage": "string",
				"navPage": "string",
				"navEnabled": "boolean",
				"pageDisplayEnabled": "boolean",
				"zoomEnabled": "boolean",
				"zoomScale": "string"
			},
			"events": {}
		},
		init: function() {
			this.count = 1;
			this.firstTime = true;
			this._toolbar = ControlUtils.getToolbar([
				ControlUtils.getSpacer(),
				ControlUtils.getButton(false, 'zoom-in', this.zoomin.bind(this)),
				ControlUtils.getButton(false, 'zoom-out', this.zoomout.bind(this)),
				ControlUtils.getText(this.getPageStatus.bind(this)),
				ControlUtils.getButton(false, 'sys-prev-page', this.prevPage.bind(this)),
				ControlUtils.getButton(false, 'sys-next-page', this.nextPage.bind(this)),
				ControlUtils.getSpacer()
			]);
			this._toolbar.setModel(new JSONModel({currentpage:0,pages:0,zoomScale: 1}),"pdf");
		},
		renderer: function(oRm, oControl) {
			oControl._toolbar.getContent()[1].setVisible(oControl.getZoomEnabled());
			oControl._toolbar.getContent()[2].setVisible(oControl.getZoomEnabled());
			oControl._toolbar.getContent()[3].setVisible(oControl.getPageDisplayEnabled());
			oControl._toolbar.getContent()[4].setVisible(oControl.getNavEnabled());
			oControl._toolbar.getContent()[5].setVisible(oControl.getNavEnabled());
			oRm.write("<div ");
			oRm.writeControlData(oControl); // writes the Control ID and enables event handling - important!
			oRm.write(">");
			oRm.renderControl(oControl._toolbar);

			oRm.write("<div id='" + `${oControl.getId()}-scrollCont'"`);
			oRm.addClass("sapMScrollCont");
			oRm.addClass("sapMScrollContVH");
			oRm.writeClasses();
			oRm.addStyle("height", oControl.getHeight());
			oRm.addStyle("overflow", "auto");
			oRm.addStyle("display", "flex");
			oRm.addStyle("align-items", "start");
			oRm.addStyle("justify-content", "center");
			oRm.writeStyles();
			oRm.write(">");
			oRm.write("<canvas id='" + oControl.getId() + "-canvas'>");
			oRm.write("</canvas>");
			oRm.write("</div>");
			oRm.write("</div>");
		},
		onAfterRendering: function(evt) {
			if (sap.ui.core.Control.prototype.onAfterRendering) {
				sap.ui.core.Control.prototype.onAfterRendering.apply(this, arguments);
			}
			// this.setPdfSource(this.getPdfSource());
			const container = window.document.getElementById(
				this.getId() + "-scrollCont",
			);
			this._containerWidth = container.offsetWidth;
			if (!this.isRendering) {
				this.updatePDF();
			}

		},
		getPageStatus:function(){
			return '{pdf>/currentpage} / {pdf>/pages}';
		},
		setPdfSource: function(pdfsource) {
			this.setProperty("pdfSource", pdfsource, true);
			this.updatePDF();
		},
		zoomin: function() {
			if (window.document.getElementById(this.getId() + "-canvas").offsetWidth >= this._containerWidth) return;
			this.scale = this.scale + 0.25;
			this.setZoomScale(this.scale);
			//this.setHeight(this.adjustHeight(this.getHeight(), 25, "add"))
			this.displayPDF(this.pageNumber);
		},
		zoomout: function() {
			this.scale = this.scale - 0.25 >= 1 ? this.scale - 0.25 : 1;
			this.setZoomScale(this.scale);
			//this.setHeight(this.adjustHeight(this.getHeight(), 25, "subtract"))
			this.displayPDF(this.pageNumber);
		},
		nextPage: async function() {
			const endPage = this.getEndPage() ? this.getEndPage() * 1 : this.pdf.numPages;
			if (this.pageNumber >= endPage) {
				return;
			}
			this.pageNumber++;
			await this.displayPDF(this.pageNumber);
			this._toolbar.rerender()
		},
		prevPage: async function() {
			var startPage = this.getStartPage() ? this.getStartPage() * 1 : 1;
			if (this.pageNumber <= startPage) {
				return;
			}
			this.pageNumber--;
			await this.displayPDF(this.pageNumber);
			this._toolbar.rerender()
		},
		updatePDF: function() {
			var me = this;
			me.isRendering = true;
			if (this.getPdfSource()) {
				this.old = this.getPdfSource();
				this.count = this.count + 1;
				this.firstTime = false;

				if (!this.worker) {
					this.worker = new pdfjsLib.PDFWorker("test2");
				}

				pdfjsLib.GlobalWorkerOptions.workerSrc = sap.ui.require.toUrl("pdfjs-dist") + "/pdf.worker.js";

				var loadingTask;

				var isUrl = /^(ftp|http|https):\/\/[^ "]+$/.test(this.getPdfSource().trim());

				if (isUrl) {
					loadingTask = pdfjsLib.getDocument({
						url: this.getPdfSource().trim(),
						worker: this.worker,
					});
				} else {
					var pdfData = atob(this.getPdfSource().split(",")[1]);
					loadingTask = pdfjsLib.getDocument({
						data: pdfData,
						worker: this.worker,
					});
				}

				loadingTask.promise.then(function(pdf) {
					me.startPage = me.getStartPage() ? me.getStartPage() * 1 : 1;
					me.endPage = me.getEndPage() ? me.getEndPage() * 1 : me.pdf.numPages * 1; 
					me.navPage = me.getNavPage() ? me.getNavPage() : 0;
					me.pageNumber = (me.navPage * 1) !== 0 ? me.navPage * 1 : me.getCurrentPage() ? me.getCurrentPage() * 1 : this.pdf.numPages;
					me.currentPage = me.pageNumber;
					me.scale = me.getZoomScale() * 1 || 1;
					me.pdf = pdf;
					me._toolbar.getModel("pdf").setProperty("/pages", me.getEndPage() ? me.getEndPage() * 1 : me.pdf.numPages);
					me.displayPDF(me.pageNumber);
					me._toolbar.rerender()
				}, function(reason) {
					console.error(reason);
				});
			}
		},
		// adjustHeight(height, percentage, operation) {
		// 	const numericValue = parseInt(height.replace('px', ''), 10);
		// 	const change = numericValue * (percentage / 100);
		// 	const newHeight = operation === 'add' ? numericValue + change : numericValue - change;
		// 	return `${newHeight}px`;
		// },

		displayPDF: async function(num) {
			var me = this;
			if (this.pdf) {
				me._toolbar.getModel("pdf").setProperty("/currentpage",num);
				const page = await this.pdf.getPage(num);
				await me.renderPDF(page);
			}
		},
		renderPDF: async function(page) {
			var me = this;
			var viewport = page.getViewport({ scale: me.scale });

			// Prepare canvas using PDF page dimensions
			var canvas = window.document.getElementById(me.getId() + "-canvas");
			if (!canvas) {
				me.isRendering = false;
				return;
			}
			var context = canvas.getContext("2d");
			canvas.height = viewport.height;
			canvas.width = viewport.width;

			// Render PDF page into canvas context
			var renderContext = {
				canvasContext: context,
				viewport: viewport
			};
			var renderTask = page.render(renderContext);
			await renderTask.promise
			me.isRendering = false;
		}
	});
});
